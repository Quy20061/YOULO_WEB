import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // ── FIX 3: Thêm TURN server public để vượt NAT đối xứng ──────
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
  ]
};

export default function VideoCall({ targetUser, callType, isIncoming, callerSignal, onEnd }) {
  const { user } = useAuth();
  const { emit, on } = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef(null);

  const stopStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.close();
    if (durationRef.current) clearInterval(durationRef.current);
  }, []);

  const endCall = useCallback(() => {
    emit('end_call', { targetId: targetUser.id });
    stopStream();
    onEnd();
  }, [emit, stopStream, onEnd, targetUser]);

  const startDurationTimer = () => {
    durationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ─── Build RTCPeerConnection + lấy media ─────────────────────────
  const buildPeer = useCallback(async () => {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video'
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e2) {
        console.error('Cannot access media:', e2);
        return null;
      }
    }

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // ── FIX 3: Đảm bảo audio remote luôn được gán và autoplay ──────
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        // Ép play audio để tránh browser block autoplay
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('ice_candidate', { targetId: targetUser.id, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
        startDurationTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('ended');
        setTimeout(() => { stopStream(); onEnd(); }, 1500);
      }
    };

    return pc;
  }, [callType, emit, targetUser, stopStream, onEnd]);

  const flushPendingCandidates = async (pc) => {
    for (const c of pendingCandidatesRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingCandidatesRef.current = [];
  };

  useEffect(() => {
    let unsubAnswered, unsubRejected, unsubEnded, unsubIce;

    if (!isIncoming) {
      // ── CALLER side ──────────────────────────────────────────────
      (async () => {
        const pc = await buildPeer();
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        emit('call_user', {
          targetId: targetUser.id,
          signal: offer,
          callType,
          callerName: user.name,
          callerAvatar: user.avatar,
        });
      })();

      unsubAnswered = on('call_answered', async ({ signal }) => {
        const pc = peerRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        await flushPendingCandidates(pc);
        setCallStatus('connected');
        startDurationTimer();
      });
    }
    // ── RECEIVER side: KHÔNG tự động answer, chờ user bấm Nghe ────
    // (xử lý trong handleAcceptCall bên dưới)

    unsubRejected = on('call_rejected', () => {
      setCallStatus('rejected');
      setTimeout(() => { stopStream(); onEnd(); }, 2000);
    });

    unsubEnded = on('call_ended', () => {
      setCallStatus('ended');
      setTimeout(() => { stopStream(); onEnd(); }, 1500);
    });

    unsubIce = on('ice_candidate', async ({ candidate }) => {
      const pc = peerRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    });

    return () => {
      unsubAnswered?.();
      unsubRejected?.();
      unsubEnded?.();
      unsubIce?.();
      stopStream();
    };
  }, []); // eslint-disable-line

  // ── FIX 2: Xử lý nhận cuộc gọi đúng — chỉ chạy khi user bấm Nghe máy ──
  const handleAcceptCall = async () => {
    setCallStatus('connecting');
    const pc = await buildPeer();
    if (!pc) {
      setCallStatus('ended');
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(callerSignal));
    await flushPendingCandidates(pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    emit('answer_call', { targetId: targetUser.id, signal: answer });
    setCallStatus('connected');
    startDurationTimer();
  };

  const handleRejectCall = () => {
    emit('reject_call', { targetId: targetUser.id });
    stopStream();
    onEnd();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!isMuted); }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!isVideoOff); }
  };

  const baseUrl = process.env.REACT_APP_API_URL || '';
  const avatar = targetUser.avatar ? `${baseUrl}${targetUser.avatar}` : null;

  const statusLabel = {
    calling: '📡 Đang gọi...',
    incoming: '📲 Cuộc gọi đến',
    connecting: '🔄 Đang kết nối...',
    connected: `${callType === 'video' ? '📹' : '🎙️'} ${formatDuration(callDuration)}`,
    rejected: '❌ Cuộc gọi bị từ chối',
    ended: '📵 Cuộc gọi kết thúc',
  }[callStatus] || '';

  return (
    <div style={styles.overlay}>
      {/* ── FIX 3: Audio element luôn hiện để browser cho phép play ── */}
      <audio ref={remoteAudioRef} autoPlay playsInline controls={false}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      <div style={styles.container}>
        {callType === 'video' && (
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
        )}

        <div style={{ ...styles.bgPanel, opacity: callType === 'video' && callStatus === 'connected' ? 0 : 1 }}>
          <div style={styles.avatarRing}>
            <div style={styles.avatarLarge}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={styles.avatarInitial}>{targetUser.name[0]}</span>
              }
            </div>
          </div>
          <h2 style={styles.callerName}>{targetUser.name}</h2>
          <p style={styles.statusText}>{statusLabel}</p>
          {callStatus === 'connected' && callType === 'audio' && (
            <div style={styles.audioBars}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ ...styles.bar, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>

        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            style={{ ...styles.localVideo, display: callStatus === 'connected' ? 'block' : 'none' }}
          />
        )}

        {callType === 'video' && callStatus === 'connected' && (
          <div style={styles.videoTopBar}>
            <span style={styles.videoName}>{targetUser.name}</span>
            <span style={styles.videoDuration}>{formatDuration(callDuration)}</span>
          </div>
        )}

        <div style={styles.controls}>
          {callStatus === 'incoming' ? (
            <>
              <div style={styles.controlGroup}>
                <button style={{ ...styles.btn, ...styles.acceptBtn }} onClick={handleAcceptCall}>
                  <span style={{ fontSize: 28 }}>📞</span>
                </button>
                <span style={styles.btnLabel}>Nghe máy</span>
              </div>
              <div style={styles.controlGroup}>
                <button style={{ ...styles.btn, ...styles.rejectBtn }} onClick={handleRejectCall}>
                  <span style={{ fontSize: 28 }}>📵</span>
                </button>
                <span style={styles.btnLabel}>Từ chối</span>
              </div>
            </>
          ) : (
            <>
              <div style={styles.controlGroup}>
                <button style={{ ...styles.btn, ...(isMuted ? styles.activeBtn : styles.controlBtn) }} onClick={toggleMute}>
                  <span style={{ fontSize: 24 }}>{isMuted ? '🔇' : '🎙️'}</span>
                </button>
                <span style={styles.btnLabel}>{isMuted ? 'Bật mic' : 'Tắt mic'}</span>
              </div>
              {callType === 'video' && (
                <div style={styles.controlGroup}>
                  <button style={{ ...styles.btn, ...(isVideoOff ? styles.activeBtn : styles.controlBtn) }} onClick={toggleVideo}>
                    <span style={{ fontSize: 24 }}>{isVideoOff ? '🚫' : '📹'}</span>
                  </button>
                  <span style={styles.btnLabel}>{isVideoOff ? 'Bật cam' : 'Tắt cam'}</span>
                </div>
              )}
              <div style={styles.controlGroup}>
                <button style={{ ...styles.btn, ...styles.rejectBtn }} onClick={endCall}>
                  <span style={{ fontSize: 24 }}>📵</span>
                </button>
                <span style={styles.btnLabel}>Kết thúc</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.96)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  container: {
    width: '100%', maxWidth: 480, height: '100vh', maxHeight: 740,
    background: 'linear-gradient(160deg, #1a0a2e 0%, #0f0f1a 100%)',
    borderRadius: 28, overflow: 'hidden', position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    border: '1px solid rgba(168,85,247,0.2)',
    boxShadow: '0 0 60px rgba(168,85,247,0.15)',
  },
  remoteVideo: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', borderRadius: 28,
  },
  bgPanel: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '40px 40px 20px', gap: 16, zIndex: 2,
    transition: 'opacity 0.5s',
  },
  avatarRing: {
    padding: 6, borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    boxShadow: '0 0 40px rgba(168,85,247,0.5)',
  },
  avatarLarge: {
    width: 120, height: 120, borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { fontSize: 48, color: 'white', fontWeight: 800 },
  callerName: { color: 'white', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, margin: 0 },
  audioBars: { display: 'flex', gap: 4, alignItems: 'flex-end', height: 32 },
  bar: {
    width: 5, borderRadius: 3,
    background: 'linear-gradient(180deg, #a855f7, #ec4899)',
    animation: 'pulse 0.8s ease-in-out infinite alternate',
    height: 20,
  },
  localVideo: {
    position: 'absolute', bottom: 110, right: 16,
    width: 100, height: 140, objectFit: 'cover',
    borderRadius: 14, border: '2px solid rgba(168,85,247,0.5)',
    zIndex: 10, transform: 'scaleX(-1)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
  },
  videoTopBar: {
    position: 'absolute', top: 20, left: 20, right: 20,
    display: 'flex', justifyContent: 'space-between', zIndex: 5,
  },
  videoName: { color: 'white', fontWeight: 700, fontSize: 15, textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
  videoDuration: { color: '#c084fc', fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
  controls: {
    position: 'absolute', bottom: 36, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', gap: 28, zIndex: 10, alignItems: 'flex-end',
  },
  controlGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  btn: {
    width: 66, height: 66, borderRadius: '50%', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  btnLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 },
  acceptBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    boxShadow: '0 0 24px rgba(34,197,94,0.5)',
  },
  rejectBtn: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    boxShadow: '0 0 24px rgba(239,68,68,0.5)',
  },
  controlBtn: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  activeBtn: {
    background: 'rgba(239,68,68,0.35)',
    border: '1px solid rgba(239,68,68,0.4)',
  },
};
