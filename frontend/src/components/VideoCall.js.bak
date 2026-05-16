import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

// TURN server giúp xuyên NAT - dùng free public TURN
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Free TURN servers để xuyên qua symmetric NAT
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ]
};

export default function VideoCall({ targetUser, callType, isIncoming, callerSignal, onEnd }) {
  const { user } = useAuth();
  const { emit, on } = useSocket();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef  = useRef([]);       // ICE candidates đến trước khi remote SDP sẵn
  const remoteSetRef   = useRef(false);    // đã setRemoteDescription chưa
  const calledRef      = useRef(false);    // tránh buildPeer() chạy 2 lần

  const [callStatus,  setCallStatus]  = useState(isIncoming ? 'incoming' : 'calling');
  const [isMuted,     setIsMuted]     = useState(false);
  const [isVideoOff,  setIsVideoOff]  = useState(false);
  const [callDuration,setCallDuration]= useState(0);
  const durationTimerRef = useRef(null);

  /* ── helpers ─────────────────────────────────────────────────────── */
  const startTimer = () => {
    if (durationTimerRef.current) return;
    durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const fmtTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const stopAll = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (peerRef.current) {
      peerRef.current.ontrack        = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    clearInterval(durationTimerRef.current);
  }, []);

  const hangUp = useCallback(() => {
    emit('end_call', { targetId: targetUser.id });
    stopAll();
    onEnd();
  }, [emit, stopAll, onEnd, targetUser]);

  /* ── flush ICE queue sau khi remoteDescription sẵn ──────────────── */
  const flushIce = async (pc) => {
    for (const c of pendingIceRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIceRef.current = [];
  };

  /* ── gán remote stream lên <video> / <audio> ─────────────────────── */
  const attachRemoteStream = (stream) => {
    if (callType === 'video' && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream;
      }
      remoteVideoRef.current.play().catch(() => {});
    } else {
      // Gọi thoại: tạo element <audio> tự động phát
      const existing = document.getElementById('__remoteAudio__');
      const audio = existing || document.createElement('audio');
      audio.id       = '__remoteAudio__';
      audio.autoplay = true;
      audio.playsInline = true;
      if (!existing) document.body.appendChild(audio);
      audio.srcObject = stream;
      audio.play().catch(() => {});
    }
  };

  /* ── tạo PeerConnection + lấy local media ─────────────────────────── */
  const buildPeer = useCallback(async () => {
    if (calledRef.current) return null;
    calledRef.current = true;

    /* 1. Lấy local stream */
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === 'video'
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      try {
        // fallback: chỉ âm thanh
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e2) {
        console.error('Media access denied:', e2);
        alert('Không thể truy cập mic/camera. Kiểm tra quyền trình duyệt.');
        return null;
      }
    }

    localStreamRef.current = stream;

    /* 2. Hiện local video preview */
    if (localVideoRef.current && callType === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    /* 3. Tạo RTCPeerConnection */
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = pc;

    /* 4. Add local tracks */
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    /* 5. Nhận remote tracks */
    pc.ontrack = (event) => {
      console.log('🎥 ontrack fired', event.track.kind, event.streams);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      attachRemoteStream(remoteStream);
    };

    /* 6. Gửi ICE candidates */
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emit('ice_candidate', { targetId: targetUser.id, candidate: e.candidate });
      }
    };

    /* 7. Theo dõi kết nối */
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('📡 connectionState:', state);
      if (state === 'connected') {
        setCallStatus('connected');
        startTimer();
      } else if (state === 'failed') {
        console.warn('Connection failed — trying ICE restart');
        pc.restartIce();
      } else if (state === 'disconnected') {
        setCallStatus('ended');
        setTimeout(() => { stopAll(); onEnd(); }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 iceState:', pc.iceConnectionState);
    };

    return pc;
  }, [callType, emit, targetUser, stopAll, onEnd]);

  /* ── useEffect chính ─────────────────────────────────────────────── */
  useEffect(() => {
    let unsubAnswered, unsubRejected, unsubEnded, unsubIce;

    /* ICE candidate handler — luôn đăng ký ngay */
    unsubIce = on('ice_candidate', async ({ candidate }) => {
      const pc = peerRef.current;
      if (!pc || !remoteSetRef.current) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    if (!isIncoming) {
      /* ══ CALLER ════════════════════════════════════════════════════ */
      (async () => {
        const pc = await buildPeer();
        if (!pc) return;

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
        await pc.setLocalDescription(offer);

        emit('call_user', {
          targetId:    targetUser.id,
          signal:      offer,
          callType,
          callerName:  user.name,
          callerAvatar:user.avatar,
        });
      })();

      unsubAnswered = on('call_answered', async ({ signal }) => {
        const pc = peerRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          remoteSetRef.current = true;
          await flushIce(pc);

          setCallStatus('connected');
          startTimer();

          /* Sau khi setRemoteDescription, kiểm tra receiver đã có track chưa */
          const receivers = pc.getReceivers();
          if (receivers.length > 0) {
            const remoteStream = new MediaStream(
              receivers.map(r => r.track).filter(Boolean)
            );
            attachRemoteStream(remoteStream);
          }
        } catch (e) { console.error('setRemoteDescription (answer) failed:', e); }
      });

    } else {
      /* ══ RECEIVER ══════════════════════════════════════════════════ */
      (async () => {
        const pc = await buildPeer();
        if (!pc) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(callerSignal));
          remoteSetRef.current = true;
          await flushIce(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          emit('answer_call', { targetId: targetUser.id, signal: answer });
          setCallStatus('connected');
          startTimer();
        } catch (e) { console.error('setRemoteDescription (offer) failed:', e); }
      })();
    }

    unsubRejected = on('call_rejected', () => {
      setCallStatus('rejected');
      setTimeout(() => { stopAll(); onEnd(); }, 2000);
    });

    unsubEnded = on('call_ended', () => {
      setCallStatus('ended');
      setTimeout(() => { stopAll(); onEnd(); }, 1500);
    });

    return () => {
      unsubAnswered?.();
      unsubRejected?.();
      unsubEnded?.();
      unsubIce?.();
      stopAll();
      // Dọn audio element tạm
      document.getElementById('__remoteAudio__')?.remove();
    };
  }, []); // eslint-disable-line

  /* ── controls ────────────────────────────────────────────────────── */
  const rejectCall = () => {
    emit('reject_call', { targetId: targetUser.id });
    stopAll();
    onEnd();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(m => !m); }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(v => !v); }
  };

  const API = process.env.REACT_APP_API_URL || '';
  const avatar = targetUser.avatar ? `${API}${targetUser.avatar}` : null;

  const statusLabel = {
    calling:    '📡 Đang gọi...',
    incoming:   '📲 Cuộc gọi đến',
    connecting: '🔄 Đang kết nối...',
    connected:  `${callType === 'video' ? '📹' : '🎙️'} ${fmtTime(callDuration)}`,
    rejected:   '❌ Cuộc gọi bị từ chối',
    ended:      '📵 Cuộc gọi kết thúc',
  }[callStatus] || '';

  /* ── JSX ─────────────────────────────────────────────────────────── */
  return (
    <div style={S.overlay}>
      <div style={S.container}>

        {/* ── Remote video (full screen) ── */}
        {callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay playsInline
            style={{
              ...S.remoteVideo,
              // Ẩn khi chưa có stream (hiện avatar thay)
              opacity: callStatus === 'connected' ? 1 : 0,
            }}
          />
        )}

        {/* ── Avatar / status panel ── */}
        <div style={{
          ...S.bgPanel,
          opacity: (callType === 'video' && callStatus === 'connected') ? 0 : 1,
          pointerEvents: (callType === 'video' && callStatus === 'connected') ? 'none' : 'auto',
        }}>
          <div style={S.avatarRing}>
            <div style={S.avatarCircle}>
              {avatar
                ? <img src={avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={S.avatarInitial}>{targetUser.name?.[0]}</span>
              }
            </div>
          </div>
          <h2 style={S.callerName}>{targetUser.name}</h2>
          <p  style={S.statusText}>{statusLabel}</p>

          {callStatus === 'connected' && callType === 'audio' && (
            <div style={S.audioBars}>
              {[...Array(5)].map((_,i) => (
                <div key={i} style={{ ...S.bar, animationDelay:`${i*0.15}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Local video preview (picture-in-picture) ── */}
        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            style={{
              ...S.localVideo,
              display: callStatus === 'connected' ? 'block' : 'none',
            }}
          />
        )}

        {/* ── Top bar khi video connected ── */}
        {callType === 'video' && callStatus === 'connected' && (
          <div style={S.topBar}>
            <span style={S.topName}>{targetUser.name}</span>
            <span style={S.topDuration}>{fmtTime(callDuration)}</span>
          </div>
        )}

        {/* ── Controls ── */}
        <div style={S.controls}>
          {callStatus === 'incoming' ? (
            /* Đầu nhận: hiện nút nghe / từ chối */
            <>
              <CtrlBtn icon="📞" label="Nghe máy" style={S.acceptBtn}
                onClick={() => {
                  // buildPeer đã chạy trong useEffect — chỉ cập nhật UI
                  setCallStatus('connecting');
                }}
              />
              <CtrlBtn icon="📵" label="Từ chối" style={S.rejectBtn} onClick={rejectCall} />
            </>
          ) : (
            <>
              <CtrlBtn
                icon={isMuted ? '🔇' : '🎙️'}
                label={isMuted ? 'Bật mic' : 'Tắt mic'}
                style={isMuted ? S.activeBtn : S.controlBtn}
                onClick={toggleMute}
              />
              {callType === 'video' && (
                <CtrlBtn
                  icon={isVideoOff ? '🚫' : '📷'}
                  label={isVideoOff ? 'Bật cam' : 'Tắt cam'}
                  style={isVideoOff ? S.activeBtn : S.controlBtn}
                  onClick={toggleVideo}
                />
              )}
              <CtrlBtn icon="📵" label="Kết thúc" style={S.rejectBtn} onClick={hangUp} />
            </>
          )}
        </div>

      </div>
    </div>
  );
}

/* ── Reusable control button ─────────────────────────────────────── */
function CtrlBtn({ icon, label, style, onClick }) {
  return (
    <div style={S.ctrlGroup}>
      <button style={{ ...S.btn, ...style }} onClick={onClick}>
        <span style={{ fontSize: 26 }}>{icon}</span>
      </button>
      <span style={S.btnLabel}>{label}</span>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const S = {
  overlay: {
    position:'fixed', inset:0, zIndex:9999,
    background:'rgba(0,0,0,0.96)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  container: {
    width:'100%', maxWidth:480, height:'100vh', maxHeight:740,
    background:'linear-gradient(160deg,#1a0a2e 0%,#0f0f1a 100%)',
    borderRadius:28, overflow:'hidden', position:'relative',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between',
    border:'1px solid rgba(168,85,247,0.2)',
    boxShadow:'0 0 60px rgba(168,85,247,0.15)',
  },

  /* remote full-screen */
  remoteVideo: {
    position:'absolute', inset:0,
    width:'100%', height:'100%',
    objectFit:'cover', borderRadius:28,
    zIndex:1,
    transition:'opacity 0.4s',
    backgroundColor:'#000',
  },

  /* background / avatar */
  bgPanel: {
    flex:1, display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    padding:'40px 40px 20px', gap:16,
    zIndex:2, transition:'opacity 0.5s',
  },
  avatarRing: {
    padding:6, borderRadius:'50%',
    background:'linear-gradient(135deg,#a855f7,#ec4899)',
    boxShadow:'0 0 40px rgba(168,85,247,0.5)',
  },
  avatarCircle: {
    width:120, height:120, borderRadius:'50%',
    background:'linear-gradient(135deg,#a855f7,#ec4899)',
    display:'flex', alignItems:'center', justifyContent:'center',
    overflow:'hidden',
  },
  avatarInitial: { fontSize:48, color:'white', fontWeight:800 },
  callerName:    { color:'white', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' },
  statusText:    { color:'rgba(255,255,255,0.6)', fontSize:15, margin:0 },
  audioBars:     { display:'flex', gap:4, alignItems:'flex-end', height:32 },
  bar: {
    width:5, height:20, borderRadius:3,
    background:'linear-gradient(180deg,#a855f7,#ec4899)',
    animation:'vcPulse 0.8s ease-in-out infinite alternate',
  },

  /* local PiP */
  localVideo: {
    position:'absolute', bottom:110, right:16,
    width:100, height:140, objectFit:'cover',
    borderRadius:14, border:'2px solid rgba(168,85,247,0.5)',
    zIndex:10, transform:'scaleX(-1)',
    boxShadow:'0 8px 20px rgba(0,0,0,0.4)',
    backgroundColor:'#111',
  },

  /* top bar */
  topBar: {
    position:'absolute', top:20, left:20, right:20,
    display:'flex', justifyContent:'space-between', zIndex:5,
  },
  topName:     { color:'white', fontWeight:700, fontSize:15, textShadow:'0 2px 8px rgba(0,0,0,0.6)' },
  topDuration: { color:'#c084fc', fontWeight:700, textShadow:'0 2px 8px rgba(0,0,0,0.6)' },

  /* controls */
  controls: {
    position:'absolute', bottom:36, left:0, right:0,
    display:'flex', justifyContent:'center', gap:28, zIndex:10, alignItems:'flex-end',
  },
  ctrlGroup: { display:'flex', flexDirection:'column', alignItems:'center', gap:6 },
  btn: {
    width:66, height:66, borderRadius:'50%', border:'none',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    transition:'transform 0.15s, box-shadow 0.15s',
  },
  btnLabel: { color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:500 },
  acceptBtn: {
    background:'linear-gradient(135deg,#22c55e,#16a34a)',
    boxShadow:'0 0 24px rgba(34,197,94,0.5)',
  },
  rejectBtn: {
    background:'linear-gradient(135deg,#ef4444,#dc2626)',
    boxShadow:'0 0 24px rgba(239,68,68,0.5)',
  },
  controlBtn: {
    background:'rgba(255,255,255,0.1)',
    backdropFilter:'blur(12px)',
    border:'1px solid rgba(255,255,255,0.15)',
  },
  activeBtn: {
    background:'rgba(239,68,68,0.35)',
    border:'1px solid rgba(239,68,68,0.4)',
  },
};
