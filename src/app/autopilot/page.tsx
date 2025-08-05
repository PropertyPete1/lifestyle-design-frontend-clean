'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';



// API configuration
const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://lifestyle-design-backend-v2-clean.onrender.com'}/api`;

// API helper functions
const api = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  },

  async post(endpoint: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  }
};

export default function AutopilotPage() {
  const [autopilotActive, setAutopilotActive] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [autopilotStatus, setAutopilotStatus] = useState<Record<string, unknown> | null>(null);
  const [queueData, setQueueData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const particlesRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState({
    maxPosts: 3,
    postTime: '14:00',
    peakHours: true,
    repostDelay: 2,
    minViews: 10000,
    visualSimilarityDays: 30,
    trendingAudio: true,
    aiCaptions: true,
    dropboxSave: false,
    platforms: ['instagram', 'youtube']
  });

  // Helper functions for real-time data
  const getNextPostTime = () => {
    const now = new Date();
    const optimalTimes = ['8:00 AM', '12:00 PM', '5:00 PM', '8:00 PM'];
    const currentHour = now.getHours();
    
    // Find next scheduled time
    const timeMap = [
      { time: '8:00 AM', hour: 8 },
      { time: '12:00 PM', hour: 12 },
      { time: '5:00 PM', hour: 17 },
      { time: '8:00 PM', hour: 20 }
    ];
    
    for (const slot of timeMap) {
      if (currentHour < slot.hour) {
        return slot.time;
      }
    }
    
    return 'Tomorrow 8:00 AM';
  };

  const getRemainingPosts = () => {
    const maxPosts = settings.maxPosts || 4;
    const todayPosts = autopilotStatus?.todayPosts || 0;
    const remaining = Math.max(0, maxPosts - todayPosts);
    return `${remaining} of ${maxPosts}`;
  };

  useEffect(() => {
    createParticles();
    loadAutopilotData();
    showNotification('🚀 Autopilot Dashboard loaded!', 'success');

    // Add keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (queueOpen) {
          toggleQueue();
        }
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveSettings();
      }
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        toggleQueue();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [queueOpen]);

  const loadAutopilotData = async () => {
    try {
      setIsLoading(true);
      
      // Load settings
      const settingsRes = await api.get('/settings');
      if (settingsRes) {
        setSettings({
          maxPosts: settingsRes.maxPosts || 3,
          postTime: settingsRes.postTime || '14:00',
          peakHours: settingsRes.peakHours !== false,
          repostDelay: settingsRes.repostDelay || 2,
          minViews: settingsRes.minViews || 10000,
          visualSimilarityDays: settingsRes.visualSimilarityDays || 30,
          trendingAudio: settingsRes.trendingAudio !== false,
          aiCaptions: settingsRes.aiCaptions !== false,
          dropboxSave: settingsRes.dropboxSave || false,
          platforms: []
        });
        setAutopilotActive(settingsRes.autopilotEnabled || false);
      }

      // Load autopilot status from Phase 9 endpoint
      const statusRes = await api.get('/autopilot/status');
      if (statusRes.success) {
        setAutopilotStatus(statusRes);
        setAutopilotActive(statusRes.autopilotEnabled || false);
      }

      // Load queue data from Phase 9 autopilot queue endpoint
      const queueRes = await api.get('/autopilot/queue');
      console.log('📋 [QUEUE DATA] Response:', queueRes);
      if (queueRes.posts) {
        setQueueData(queueRes.posts || []); // ✅ FIXED: Use posts array from backend
      }

    } catch (error) {
      console.error('❌ Failed to load autopilot data:', error);
      showNotification('❌ Failed to load autopilot data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createParticles = () => {
    if (!particlesRef.current) return;
    
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      particlesRef.current.appendChild(particle);
    }
  };

  const toggleQueue = () => {
    setQueueOpen(!queueOpen);
    
    if (!queueOpen) {
      document.body.style.overflow = 'hidden';
      showNotification('🔁 Smart Queue opened', 'success');
    } else {
      document.body.style.overflow = 'auto';
    }
  };

  const toggleSwitch = (settingKey: string) => {
    setSettings(prev => ({
      ...prev,
      [settingKey]: !prev[settingKey as keyof typeof prev]
    }));
    
    const isActive = !settings[settingKey as keyof typeof settings];
    showNotification(`Setting ${isActive ? 'enabled' : 'disabled'}`, 'success');
  };

  const togglePlatform = (platform: string) => {
    setSettings(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
    
    const isSelected = !settings.platforms.includes(platform);
    showNotification(`${platform} ${isSelected ? 'enabled' : 'disabled'}`, 'success');
  };

  const saveSettings = async () => {
    try {
      console.log('Saving settings:', settings);
      
      // Update settings in backend
      await api.post('/settings', {
        maxPosts: settings.maxPosts,
        postTime: settings.postTime,
        peakHours: settings.peakHours,
        repostDelay: settings.repostDelay,
        minViews: settings.minViews,
        visualSimilarityDays: settings.visualSimilarityDays,
        trendingAudio: settings.trendingAudio,
        aiCaptions: settings.aiCaptions,
        dropboxSave: settings.dropboxSave,
        autopilotEnabled: autopilotActive
      });
      
      showNotification('💾 Settings saved successfully!', 'success');
      await loadAutopilotData(); // Reload data
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      showNotification('❌ Failed to save settings', 'error');
    }
  };

  const runNow = async () => {
    try {
      showNotification('📅 Scheduling video for optimal posting time...', 'success');
      
      const res = await api.post('/autopost/run-now', {
        videoPath: '/temp/example-video.mp4',
        originalCaption: 'Great lifestyle content!',
        platform: 'instagram'
      });

      if (res.message) {
        showNotification(`✅ Video scheduled! ${res.message}`, 'success');
        await loadAutopilotData(); // Reload data to show updated queue
      } else {
        showNotification(`❌ Scheduling failed: ${res.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ Scheduling failed:', error);
      showNotification('❌ Scheduling failed', 'error');
    }
  };

  const postNow = async () => {
    try {
      showNotification('🚀 Posting all queued videos now...', 'success');
      
      const result = await api.post('/phase9/post-now', {});
      
      if (result.success) {
        showNotification(`✅ Posted ${result.data.posted} videos successfully!`, 'success');
        await loadAutopilotData(); // Reload data to show updated statuses
      } else {
        showNotification('❌ Posting failed', 'error');
      }
    } catch (error) {
      console.error('❌ Posting failed:', error);
      showNotification('❌ Posting failed', 'error');
    }
  };

  const startAutopilot = async () => {
    try {
      const response = await api.post('/settings', { autopilotEnabled: true });
      setAutopilotActive(true);
      showNotification('🚀 Autopilot started successfully!', 'success');
      
      // Check if Phase 9 was triggered
      if (response.autopilotTriggered) {
        showNotification('📊 Phase 9 system triggered!', 'success');
      }
      
      await loadAutopilotData();
    } catch (error) {
      console.error('❌ Failed to start autopilot:', error);
      showNotification('❌ Failed to start autopilot', 'error');
    }
  };

  const stopAutopilot = async () => {
    try {
      await api.post('/settings', { autopilotEnabled: false });
      setAutopilotActive(false);
      showNotification('⏹️ Autopilot stopped', 'success');
      await loadAutopilotData();
    } catch (error) {
      console.error('❌ Failed to stop autopilot:', error);
      showNotification('❌ Failed to stop autopilot', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  const updateSetting = (key: string, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="floating-particles" ref={particlesRef}></div>
      
      <div className="autopilot-container">
        <Link href="/dashboard" className="back-button">
          ← Back to Dashboard
        </Link>

        {/* View Queue Button */}
        <div className="queue-trigger">
          <button className="view-queue-btn" onClick={toggleQueue}>
            🔁 View Smart Queue
          </button>
        </div>

        {/* Autopilot Header */}
        <div className="autopilot-header">
          <h1 className="autopilot-title">🚀 Autopilot Dashboard</h1>
          
          <div className="status-display">
            <div className={`status-indicator ${autopilotActive ? 'status-active' : 'status-paused'}`}></div>
            <span>{autopilotActive ? '✅ Autopilot is Active' : '❌ Autopilot is Paused'}</span>
          </div>
          
          <div className="status-details">
            <span>Next post scheduled for <strong>{getNextPostTime()}</strong></span>
            <span>•</span>
            <span>Posts remaining today: <strong>{getRemainingPosts()}</strong></span>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="settings-panel">
          <h2 className="settings-title">⚙️ Autopilot Settings</h2>
          
          <div className="settings-grid">
            {/* Max Posts Per Day */}
            <div className="setting-item">
              <label className="setting-label">
                📊 Max Posts Per Day
              </label>
              <input 
                type="number" 
                className="setting-input" 
                value={settings.maxPosts} 
                min="1" 
                max="10"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 10) {
                    updateSetting('maxPosts', value);
                  }
                }}
              />
              <div className="setting-description">Maximum number of posts to publish daily</div>
            </div>

            {/* Preferred Post Time */}
            <div className="setting-item">
              <label className="setting-label">
                🕐 Preferred Post Time
              </label>
              <input 
                type="time" 
                className="setting-input" 
                value={settings.postTime}
                onChange={(e) => updateSetting('postTime', e.target.value)}
              />
              <div className="setting-description">Default time to schedule posts</div>
            </div>

            {/* Peak Hour Targeting */}
            <div className="setting-item">
              <label className="setting-label">
                🎯 Peak Hour Targeting
              </label>
              <div 
                className={`toggle-switch ${settings.peakHours ? 'active' : ''}`} 
                onClick={() => toggleSwitch('peakHours')}
              >
                <div className="toggle-slider"></div>
              </div>
              <div className="setting-description">Use AI to optimize post timing for maximum engagement</div>
            </div>

            {/* Reposting Delay */}
            <div className="setting-item">
              <label className="setting-label">
                🔄 Reposting Delay (Days)
              </label>
              <input 
                type="number" 
                className="setting-input" 
                value={settings.repostDelay} 
                min="1" 
                max="30"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 30) {
                    updateSetting('repostDelay', value);
                  }
                }}
              />
              <div className="setting-description">Days to wait before reposting content</div>
            </div>

            {/* Minimum Views to Repost */}
            <div className="setting-item">
              <label className="setting-label">
                👀 Minimum IG Views to Repost
              </label>
              <input 
                type="number" 
                className="setting-input" 
                value={settings.minViews} 
                min="1000" 
                step="1000"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 0) {
                    updateSetting('minViews', value);
                  }
                }}
              />
              <div className="setting-description">Minimum view count required for automatic reposting</div>
            </div>

            {/* Visual Similarity Protection */}
            <div className="setting-item">
              <label className="setting-label">
                🎨 Visual Similarity Protection (Days)
              </label>
              <input 
                type="number" 
                className="setting-input" 
                value={settings.visualSimilarityDays} 
                min="7" 
                max="90"
                step="1"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 90) {
                    updateSetting('visualSimilarityDays', value);
                  }
                }}
              />
              <div className="setting-description">Days to avoid visually similar content (currently {settings.visualSimilarityDays} days)</div>
            </div>

            {/* Attach Trending Audio */}
            <div className="setting-item">
              <label className="setting-label">
                🎵 Attach Trending Audio
              </label>
              <div 
                className={`toggle-switch ${settings.trendingAudio ? 'active' : ''}`} 
                onClick={() => toggleSwitch('trendingAudio')}
              >
                <div className="toggle-slider"></div>
              </div>
              <div className="setting-description">Automatically add trending audio to video posts</div>
            </div>

            {/* Rewrite Captions with AI */}
            <div className="setting-item">
              <label className="setting-label">
                🤖 Rewrite Captions with AI
              </label>
              <div 
                className={`toggle-switch ${settings.aiCaptions ? 'active' : ''}`} 
                onClick={() => toggleSwitch('aiCaptions')}
              >
                <div className="toggle-slider"></div>
              </div>
              <div className="setting-description">Use AI to optimize captions for better engagement</div>
            </div>

            {/* Save All to Dropbox */}
            <div className="setting-item">
              <label className="setting-label">
                💾 Save All to Dropbox
              </label>
              <div 
                className={`toggle-switch ${settings.dropboxSave ? 'active' : ''}`} 
                onClick={() => toggleSwitch('dropboxSave')}
              >
                <div className="toggle-slider"></div>
              </div>
              <div className="setting-description">Automatically backup all content to Dropbox</div>
            </div>

            {/* Platform Scope */}
            <div className="setting-item">
              <label className="setting-label">
                📱 Platform Scope
              </label>
              <div className="multi-select">
                <div 
                  className={`platform-chip ${settings.platforms.includes('instagram') ? 'selected' : ''}`} 
                  onClick={() => togglePlatform('instagram')}
                >
                  📷 Instagram
                </div>
                <div 
                  className={`platform-chip ${settings.platforms.includes('youtube') ? 'selected' : ''}`} 
                  onClick={() => togglePlatform('youtube')}
                >
                  ▶️ YouTube
                </div>
              </div>
              <div className="setting-description">Select which platforms to include in automation</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="action-btn btn-save" onClick={saveSettings}>
              💾 Save Autopilot Settings
            </button>
            <button className="action-btn btn-run" onClick={runNow}>
              🔄 Run Now
            </button>

            {!autopilotActive ? (
              <button className="action-btn btn-start" onClick={startAutopilot}>
                ▶️ Start Autopilot
              </button>
            ) : (
              <button className="action-btn btn-stop" onClick={stopAutopilot}>
                ⏹️ Stop Autopilot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Smart Queue Drawer */}
      <div 
        className={`queue-overlay ${queueOpen ? 'show' : ''}`} 
        onClick={toggleQueue}
      ></div>
      <div className={`queue-drawer ${queueOpen ? 'open' : ''}`}>
        <div className="queue-header">
          <h2 className="queue-title">🔁 Smart Autopilot Queue</h2>
          <p className="queue-subtitle">AI-optimized videos ready for automatic posting</p>
          <button className="close-queue" onClick={toggleQueue}>×</button>
        </div>
        
        <div className="queue-content">
          {isLoading ? (
            <div className="loading-state" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              color: '#64748b'
            }}>
              <div className="loading-spinner" style={{
                width: '40px',
                height: '40px',
                border: '3px solid #f3f4f6',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
              }}></div>
              <p style={{ margin: 0, fontSize: '16px' }}>Loading queue...</p>
            </div>
          ) : queueData.length === 0 ? (
            <div className="empty-state" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div className="empty-icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>No videos in queue</h3>
              <p style={{ margin: 0, fontSize: '16px' }}>Run autopilot to populate the queue with optimized content</p>
            </div>
          ) : (
            queueData.map((video, index) => (
              <div key={video.id || index} className="video-card">
                <div className="video-preview" style={{
                  backgroundImage: video.s3Url ? `url(${video.s3Url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  width: '100px',
                  height: '180px',
                  borderRadius: '8px',
                  position: 'relative',
                  border: '2px solid #2d3748'
                }}>
                  <div className="play-overlay" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: '24px',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                  }}>▶</div>
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    right: '8px',
                    color: 'white',
                    fontSize: '12px',
                    textAlign: 'center',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                  }}>
                    {video.platform === 'instagram' ? '📷' : '▶️'} {video.platform}
                  </div>
                  {video.engagement && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {video.engagement.toLocaleString()} 💖
                    </div>
                  )}
                </div>
                
                <div className="video-caption">
                  <div className="caption-label">🤖 AI-Generated Caption</div>
                  <div className="caption-text">
                    {video.caption || 'No caption available'}
                  </div>
                </div>
            
                <div className="video-metadata">
                  <div className="metadata-item">
                    <div className="metadata-label">📱 Platform</div>
                    <div className="platform-badges">
                      <span className={`platform-badge ${video.platform === 'instagram' ? 'badge-instagram' : 'badge-youtube'}`}>
                        {video.platform === 'instagram' ? '📷 Instagram' : '▶️ YouTube'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="metadata-item">
                    <div className="metadata-label">⏰ Scheduled Time</div>
                    <div className="metadata-value">
                      {video.scheduledAt 
                        ? new Date(video.scheduledAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }) + ' (Peak Hour)'
                        : 'Not scheduled'
                      }
                    </div>
                  </div>
                  
                  <div className="metadata-item">
                    <div className="metadata-label">📊 Status</div>
                    <span className={`status-badge status-${video.status || 'unknown'}`}>
                      {video.status ? video.status.charAt(0).toUpperCase() + video.status.slice(1) : 'Unknown'}
                    </span>
                  </div>

                  <div className="metadata-item">
                    <div className="metadata-label">🎯 Original Engagement</div>
                    <div className="metadata-value">
                      {video.engagement ? video.engagement.toLocaleString() : 'N/A'}
                    </div>
                  </div>

                  <div className="metadata-item">
                    <div className="metadata-label">☁️ S3 Video</div>
                    <div className="metadata-value" style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                      {video.s3Url ? '✅ Uploaded' : '❌ Missing'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}


          {/* Post Now Button */}
          {queueData.length > 0 && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button className="action-btn btn-run" onClick={postNow}>
                🚀 Post Now
              </button>
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                This will immediately post all queued videos to their platforms
              </div>
            </div>
          )}

          {/* AI Note */}
          <div className="ai-note">
            <p className="ai-note-text">
              All scheduling, captioning, and audio are optimized by AI using peak engagement trends and platform algorithms.
            </p>
          </div>
        </div>
      </div>


    </div>
  );
}