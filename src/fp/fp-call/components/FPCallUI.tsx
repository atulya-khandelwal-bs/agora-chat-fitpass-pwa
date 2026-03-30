// import React, { useEffect } from "react";
import React from "react";
import { LocalUser, RemoteUser } from "agora-rtc-react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  RotateCcw,
  Volume2,
  VolumeX,
  Ellipsis,
} from "lucide-react";
import type { FPCallUIProps } from "../../common/types/call";

export const FPCallUI = ({
  // Connection state
  isConnected,
  isStandalone,
  calling,
  // Media tracks
  localMicrophoneTrack,
  localCameraTrack,
  remoteUsers,
  // Media controls
  micOn,
  setMic,
  cameraOn,
  setCamera,
  speakerOn,
  setSpeakerOn,
  // Flip camera
  flipCamera,
  canFlipCamera,
  // UI state
  showMoreOptions,
  setShowMoreOptions,
  controlsVisible,
  setControlsVisible,
  mainUserId,
  setMainUserId,
  // Refs
  videoContainerRef,
  hideControlsTimerRef,
  // Standalone mode props
  appId,
  setAppId,
  channel,
  setChannel,
  uid,
  setUid,
  token,
  setToken,
  generatingToken,
  generateToken,
  handleJoinCall,
  // Other props
  isAudioCall,
  onEndCall,
  peerPresenceStatus,
  // User info
  localUserName,
  localUserPhoto,
  localUserId,
  peerName,
  peerAvatar,
}: FPCallUIProps): React.JSX.Element => {
  // Helper function to get initials from name or userId
  const getInitials = (name?: string, userId?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (userId) {
      return userId.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  // Helper component for circular avatar
  const CircularAvatar = ({
    name,
    photo,
    userId,
    size = 120,
  }: {
    name?: string;
    photo?: string;
    userId?: string;
    size?: number;
  }): React.JSX.Element => {
    const initials = getInitials(name, userId);
    const hasPhoto = photo && photo.trim() !== "";

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: hasPhoto ? "transparent" : "#4f46e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {hasPhoto ? (
          <img
            src={photo}
            alt={name || "User"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                parent.style.background = "#4f46e5";
                const initialsDiv = document.createElement("div");
                initialsDiv.textContent = initials;
                initialsDiv.style.cssText = `
                  color: #ffffff;
                  font-size: ${size * 0.4}px;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 100%;
                  height: 100%;
                `;
                parent.appendChild(initialsDiv);
              }
            }}
          />
        ) : (
          <span
            style={{
              color: "#ffffff",
              fontSize: `${size * 0.4}px`,
              fontWeight: 600,
            }}
          >
            {initials}
          </span>
        )}
      </div>
    );
  };

  // Toggle controls visibility on mobile tap
  const toggleControls = (): void => {
    if (window.innerWidth <= 768) {
      setControlsVisible(!controlsVisible);
      // Clear any existing timer
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
    }
  };

  // Show call UI if connected OR if calling is true (to handle delay in isConnected update)
  const shouldShowCallUI = isConnected || calling;


  return (
    <>
      {shouldShowCallUI ? (
        <div
          className="video-call-container"
          ref={videoContainerRef}
          onClick={toggleControls}
        >
          {/* Header */}
          <div
            className={`call-header ${
              controlsVisible ? "controls-visible" : "controls-hidden"
            }`}
            onClick={toggleControls}
          >
            <h1 className="call-title">
              {isAudioCall ? "Audio Call" : "Video Call"}
            </h1>
            <div className="participant-count">
              {remoteUsers.length + 1} participant
              {remoteUsers.length !== 0 ? "s" : ""}
            </div>
            {peerPresenceStatus && remoteUsers.length === 0 && (
              <div
                className="presence-status"
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {peerPresenceStatus === "waiting" && (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#f59e0b",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    <span>Waiting for peer to join...</span>
                  </>
                )}
                {peerPresenceStatus === "in_call" && (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                      }}
                    />
                    <span>Peer is in call</span>
                  </>
                )}
                {peerPresenceStatus === "offline" && (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#6b7280",
                      }}
                    />
                    <span>Peer is offline</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Video Grid */}
          <div className={`video-grid users-${remoteUsers.length + 1}`}>
            {/* Determine if local user is main based on mainUserId */}
            {remoteUsers.length === 1 && mainUserId === null ? (
              // Local user is main (full screen)
              <>
                <div className="video-item local main-video">
                  <div className="video-container">
                    {localCameraTrack && cameraOn && !isAudioCall ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        {isAudioCall ? (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Audio Call"}
                            </span>
                          </>
                        ) : cameraOn ? (
                          "Waiting for camera..."
                        ) : (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Camera off"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Remote user */}
                {remoteUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="video-item remote-overlay"
                    onClick={(): void => {
                      setMainUserId(user.uid);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Check for actual track presence first, not just hasVideo flag */}
                    {user.videoTrack ? (
                      <RemoteUser
                        user={user}
                        playVideo={true}
                        playAudio={true}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        <CircularAvatar
                          name={peerName}
                          photo={peerAvatar}
                          userId={undefined}
                          size={120}
                        />
                        <span style={{ fontSize: "16px", fontWeight: 500 }}>
                          {peerName || "Camera off"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : remoteUsers.length === 1 && mainUserId !== null ? (
              // Remote user is main (full screen)
              <>
                {remoteUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="video-item remote-main main-video"
                  >
                    {/* Check for actual track presence first, not just hasVideo flag */}
                    {user.videoTrack ? (
                      <RemoteUser
                        user={user}
                        playVideo={true}
                        playAudio={true}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        <CircularAvatar
                          name={peerName}
                          photo={peerAvatar}
                          userId={undefined}
                          size={120}
                        />
                        <span style={{ fontSize: "16px", fontWeight: 500 }}>
                          {peerName || "Camera off"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Local user */}
                <div
                  className="video-item local remote-overlay"
                  onClick={(): void => {
                    setMainUserId(null);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="video-container">
                    {localCameraTrack && cameraOn && !isAudioCall ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        {isAudioCall ? (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Audio Call"}
                            </span>
                          </>
                        ) : cameraOn ? (
                          "Waiting for camera..."
                        ) : (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Camera off"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              // Default layout for 1 user or 3+ users (no switching)
              <>
                <div className="video-item local main-video">
                  <div className="video-container">
                    {localCameraTrack && cameraOn && !isAudioCall ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        {isAudioCall ? (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Audio Call"}
                            </span>
                          </>
                        ) : cameraOn ? (
                          "Waiting for camera..."
                        ) : (
                          <>
                            <CircularAvatar
                              name={localUserName}
                              photo={localUserPhoto}
                              userId={localUserId}
                              size={120}
                            />
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {localUserName || "Camera off"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Remote Users */}
                {remoteUsers.map((user) => (
                  <div key={user.uid} className="video-item remote-overlay">
                    {/* Check for actual track presence first, not just hasVideo flag */}
                    {user.videoTrack ? (
                      <RemoteUser
                        user={user}
                        playVideo={true}
                        playAudio={true}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                          gap: "16px",
                        }}
                      >
                        <CircularAvatar
                          name={peerName}
                          photo={peerAvatar}
                          userId={undefined}
                          size={120}
                        />
                        <span style={{ fontSize: "16px", fontWeight: 500 }}>
                          {peerName || "Camera off"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Control Bar */}
          <div
            className={`control-bar ${
              controlsVisible ? "controls-visible" : "controls-hidden"
            }`}
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e): void => {
              // Prevent toggle when clicking on control buttons
              e.stopPropagation();
            }}
          >
            {/* 1. Speaker/Volume Control */}
            <button
              className={`control-button ${!speakerOn ? "active" : ""}`}
              onClick={(e): void => {
                e.stopPropagation();
                setSpeakerOn((a) => !a);
              }}
              title={speakerOn ? "Mute speaker" : "Unmute speaker"}
            >
              <div className="control-icon">
                {speakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
            </button>

            {/* 2. Video Camera Control */}
            {!isAudioCall && (
              <button
                className={`control-button ${!cameraOn ? "active" : ""}`}
                onClick={(e): void => {
                  e.stopPropagation();
                  setCamera((a) => !a);
                }}
                title={cameraOn ? "Stop video" : "Start video"}
              >
                <div className="control-icon">
                  {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </div>
              </button>
            )}

            {/* 3. End Call (Red Rectangular Button) */}
            <button
              className="control-button danger"
              onClick={(e): void => {
                e.stopPropagation();
                onEndCall();
              }}
              title={calling ? "End call" : "Join call"}
              style={{
                borderRadius: "8px",
                minWidth: "60px",
                padding: "0.75rem 1.25rem",
              }}
            >
              <div className="control-icon">
                <Phone size={18} style={{ transform: "rotate(135deg)" }} />
              </div>
            </button>

            {/* 4. Microphone Control */}
            <button
              className={`control-button ${!micOn ? "active" : ""}`}
              onClick={(e): void => {
                e.stopPropagation();
                setMic((a) => !a);
              }}
              title={micOn ? "Mute microphone" : "Unmute microphone"}
            >
              <div className="control-icon">
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </div>
            </button>

            {/* 5. More Options */}
            {!isAudioCall && (
              <div style={{ position: "relative" }}>
                <button
                  className="control-button more-options-button"
                  onClick={(e): void => {
                    e.stopPropagation();
                    setShowMoreOptions((prev) => !prev);
                  }}
                  title="More options"
                >
                  <div className="control-icon">
                    <Ellipsis size={18} />
                  </div>
                </button>

                {/* More Options Menu */}
                {showMoreOptions && (
                  <div
                    className="more-options-menu"
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      right: "0",
                      marginBottom: "0.5rem",
                      background: "white",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      padding: "0.5rem",
                      zIndex: 1000,
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="control-button"
                      onClick={async (e): Promise<void> => {
                        e.stopPropagation();
                        if (flipCamera) {
                          await flipCamera();
                        }
                        setShowMoreOptions(false);
                      }}
                      disabled={!canFlipCamera}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        justifyContent: "center",
                        opacity: canFlipCamera ? 1 : 0.5,
                        cursor: canFlipCamera ? "pointer" : "not-allowed",
                      }}
                      title={
                        canFlipCamera
                          ? "Flip Camera"
                          : "Only one camera available"
                      }
                    >
                      <div className="control-icon">
                        <RotateCcw size={18} />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : isStandalone ? (
        <div className="join-screen">
          <div className="join-form">
            <h2 className="join-title">Join Video Call</h2>

            <div className="form-group">
              <label className="form-label">App ID</label>
              <input
                className="form-input"
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setAppId(e.target.value)
                }
                placeholder="Enter your App ID"
                value={appId}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Channel Name</label>
              <input
                className="form-input"
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                  setChannel(e.target.value)
                }
                placeholder="Enter channel name"
                value={channel}
              />
            </div>

            <div className="form-group">
              <label className="form-label">UID</label>
              <input
                className="form-input"
                type="number"
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                  const value = e.target.value;
                  setUid(value === "" ? "" : Number(value));
                }}
                placeholder="Enter your UID"
                value={uid === "" ? "" : uid}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Token (Optional - Auto-generated if empty)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="form-input"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
                    setToken(e.target.value)
                  }
                  placeholder="Enter your token or generate one"
                  value={token}
                  style={{ flex: 1 }}
                />
                <button
                  className="join-button"
                  onClick={generateToken}
                  disabled={
                    !channel || typeof uid !== "number" || generatingToken
                  }
                  style={{
                    minWidth: "120px",
                    padding: "10px 16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {generatingToken ? "Generating..." : "Generate Token"}
                </button>
              </div>
            </div>

            <button
              className="join-button"
              disabled={!appId || !channel || typeof uid !== "number"}
              onClick={handleJoinCall}
            >
              Join Call
            </button>
          </div>
        </div>
      ) : (
        <div className="join-screen">
          <div className="join-form">
            <h2 className="join-title">Joining call...</h2>
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              Generating token and connecting...
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default FPCallUI;
