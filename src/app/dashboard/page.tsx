'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
const DashboardChart = dynamic(() => import('../../components/DashboardChart'), { ssr: false });
import HeartStatusCard from '../../components/HeartStatusCard';
const ActivityHeatmap = dynamic(() => import('../../components/ActivityHeatmap'), { ssr: false });
import RecentAutoPilotPostsWrapper from '../../components/RecentAutoPilotPostsWrapper';
import { API_ENDPOINTS } from '../../utils/api';
import NotificationSystem from '../../components/NotificationSystem';

type DashboardSettings = {
  autopilotEnabled: boolean
  maxPosts: number
  postTime: string
  repostDelay: number
  manual: boolean
}

const defaultStatus: DashboardSettings = {
  autopilotEnabled: false,
  maxPosts: 3,
  postTime: '14:00',
  repostDelay: 1,
  manual: true
}

function Dashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  // Do not early-return before declaring hooks; render is gated below to keep hook order stable
  const [currentPlatform, setCurrentPlatform] = useState('instagram');
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<DashboardSettings>(defaultStatus);
  
  // ✅ Ultra-robust unique key generator with global counter
  const uniqueKeyCounter = useRef(0);
  const generateUniqueKey = useCallback((post: any, index: number, prefix: string) => {
    // Triple-layer uniqueness: prefix + index + incrementing counter + random component
    uniqueKeyCounter.current += 1;
    return `${prefix}-${index}-${uniqueKeyCounter.current}-${Math.random().toString(36).substr(2, 5)}`;
  }, []);
  const [stats, setStats] = useState({
    instagram: {
      followers: '24.8K',
      engagement: '4.7%',
      reach: '89.2K',
      autoPostsPerDay: `${status.maxPosts}/day`
    },
    youtube: {
      subscribers: 'N/A',
      watchTime: 'N/A',
      views: 'N/A',
      autoUploadsPerWeek: '2/week'
    }
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ instagram: boolean; youtube: boolean }>({ instagram: false, youtube: false });
  const [timeseries, setTimeseries] = useState<{ labels: string[]; instagram: number[]; youtube: number[]; combined: number[] } | null>(null);
  const [showSeries, setShowSeries] = useState<{ combined: boolean; instagram: boolean; youtube: boolean }>({ combined: true, instagram: false, youtube: false });
  const [recentActivity, setRecentActivity] = useState<Record<string, unknown>[]>([]);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [manualPostRunning, setManualPostRunning] = useState(false); // Separate state for manual post button
  const [autopilotStatus, setAutopilotStatus] = useState('idle'); // 'idle', 'running', 'success', 'error'
  const [autopilotVolume, setAutopilotVolume] = useState(3); // posts per day
  const [engagementScore, setEngagementScore] = useState(0.65); // 0-1 normalized
  const [newHighScore, setNewHighScore] = useState(false);
  const [lastPostSpike, setLastPostSpike] = useState<number | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [platformSettings, setPlatformSettings] = useState({
    instagram: true,
    youtube: true
  });
  const [platformData, setPlatformData] = useState({
    instagram: { active: false, todayPosts: 0, reach: 0, engagement: 0 },
    youtube: { active: false, todayPosts: 0, reach: 0, engagement: 0 }
  });
  const [trendingFlags, setTrendingFlags] = useState<{ instagram: boolean; youtube: boolean }>({ instagram: false, youtube: false });
  const [lastPostSpikeByPlatform, setLastPostSpikeByPlatform] = useState<{ instagram: number | null; youtube: number | null }>({ instagram: null, youtube: null });
  const [lastQueueUpdate, setLastQueueUpdate] = useState<number>(0);
  
  // ✅ NEW: Enhanced activity feed and chart state
  const [enhancedActivity, setEnhancedActivity] = useState<any[]>([]);
  const [queuedPosts, setQueuedPosts] = useState<any[]>([]);
  const [showUpcoming, setShowUpcoming] = useState(true); // Toggle between upcoming and recent
  const [chartData, setChartData] = useState<any>(null);
  const [credentialsDebug, setCredentialsDebug] = useState<any>(null);
  
  // ✅ NEW: Real-time notifications - DISABLED
  // const [notificationHandler, setNotificationHandler] = useState<((message: string, type?: 'success' | 'error' | 'info') => void) | null>(null);
  const [lastAutopilotCheck, setLastAutopilotCheck] = useState<number>(0);
  const [lastActivityCount, setLastActivityCount] = useState<number>(0);
  
  // ✅ Memoize notification handler setter to prevent render loops - DISABLED
  // const handleNotificationSetup = useCallback((handler: (message: string, type?: 'success' | 'error' | 'info') => void) => {
  //   setNotificationHandler(() => handler);
  // }, []);
  
  // ✅ Real Analytics fetch function prioritizing unified endpoint (clean backend), then v2
  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      console.log('📊 [DASHBOARD] Fetching analytics (unified first)...');

      // Try unified endpoint first (TS backend)
      let unified: any = null;
      try {
        const response = await fetch(API_ENDPOINTS.analytics());
        if (response.ok) unified = await response.json();
        else setAnalyticsError(`Analytics error ${response.status}`);
      } catch (e: any) {
        setAnalyticsError(e?.message || 'Failed to load analytics');
      }

      // If unified missing, try v2 endpoints for real metrics
      let igData: any = null;
      let ytData: any = null;
      if (!unified) {
        const [igRes, ytRes] = await Promise.allSettled([
          fetch(API_ENDPOINTS.instagramAnalytics()),
          fetch(API_ENDPOINTS.youtubeAnalytics())
        ]);
        if (igRes.status === 'fulfilled' && igRes.value.ok) {
          const igJson = await igRes.value.json().catch(() => ({}));
          igData = igJson.analytics || igJson || null;
        }
        if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
          const ytJson = await ytRes.value.json().catch(() => ({}));
          ytData = ytJson.analytics || ytJson || null;
        }
      }

      // Format helpers
      const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return (Number.isFinite(num) ? num : 0).toString();
      };
      const toPercentString = (val: number) => `${val.toFixed(1)}%`;

      // Resolve Instagram metrics from unified or v2
      const ig = unified?.instagram || igData || {};
      const igFollowers = ig.followers ?? ig.followers_count ?? 0;
      let igEngagementVal = ig.engagementRate ?? ig.engagement ?? 0; // could be 0-1 or 0-100
      igEngagementVal = typeof igEngagementVal === 'number' ? (igEngagementVal <= 1 ? igEngagementVal * 100 : igEngagementVal) : 0;
      const igReach = ig.reach ?? ig.views ?? 0;

      // Resolve YouTube metrics
      const yt = unified?.youtube || ytData || {};
      const ytSubscribers = yt.subscribers ?? yt.subscriberCount ?? 0;
      const ytViews = yt.views ?? yt.viewCount ?? yt.reach ?? 0;
      const ytWatch = yt.watchTimeHours ?? yt.watchTime ?? null;
      
      // Update stats with resolved data
      setStats({
        instagram: {
          followers: formatNumber(igFollowers),
          engagement: toPercentString(Number(igEngagementVal) || 0),
          reach: formatNumber(igReach),
          autoPostsPerDay: `${status.maxPosts}/day`
        },
        youtube: {
          subscribers: formatNumber(ytSubscribers),
          watchTime: ytWatch != null ? `${formatNumber(Number(ytWatch))}h` : 'N/A',
          views: formatNumber(ytViews),
          autoUploadsPerWeek: '2/week'
        }
      });

      // Connected flags
      setConnected({ instagram: !!ig.connected, youtube: !!yt.connected });

      // Timeseries for line chart (labels in CT, render as MMM d)
      if (unified?.timeseries) {
        const lbls: string[] = Array.isArray(unified.timeseries.labels) ? unified.timeseries.labels : [];
        const formatLabel = (isoDateKey: string) => {
          // Expect YYYY-MM-DD; render as MMM d with CT suffix in title
          const [y, m, d] = isoDateKey.split('-').map((v: string) => parseInt(v, 10));
          const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
          return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        const formatted = lbls.map(formatLabel);
        const igS: number[] = Array.isArray(unified.timeseries.instagram) ? unified.timeseries.instagram : [];
        const ytS: number[] = Array.isArray(unified.timeseries.youtube) ? unified.timeseries.youtube : [];
        const combined: number[] = Array.isArray(unified.timeseries.combined) ? unified.timeseries.combined : [];
        setTimeseries({ labels: formatted, instagram: igS, youtube: ytS, combined });
      } else {
        // Fallback: derive a 7-day series from activity feed
        try {
          const res = await fetch(API_ENDPOINTS.activityFeed(100));
          if (res.ok) {
            const data = await res.json();
            const activities: any[] = data?.data || [];
            const today = new Date();
            const last7: string[] = [...Array(7)].map((_, i) => {
              const d = new Date(today);
              d.setDate(today.getDate() - i);
              // Use local day key; visual only
              return d.toISOString().split('T')[0];
            }).reverse();
            const counts: Record<string, { ig: number; yt: number }> = {};
            last7.forEach(k => counts[k] = { ig: 0, yt: 0 });
            activities.forEach((a: any) => {
              const t = new Date(a.startTime || a.timestamp || a.createdAt || Date.now());
              const key = t.toISOString().split('T')[0];
              if (counts[key]) {
                const p = (a.platform || '').toString().toLowerCase();
                if (p.includes('instagram')) counts[key].ig += 1;
                if (p.includes('youtube')) counts[key].yt += 1;
              }
            });
            const labels = last7.map(k => {
              const [y, m, d] = k.split('-').map(x => parseInt(x, 10));
              const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
              return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const igArr = last7.map(k => counts[k].ig);
            const ytArr = last7.map(k => counts[k].yt);
            const combined = igArr.map((v, i) => v + ytArr[i]);
            setTimeseries({ labels, instagram: igArr, youtube: ytArr, combined });
          } else {
            setTimeseries(null);
          }
        } catch {
          setTimeseries(null);
        }
      }
      
      // Update platform data for heart cards and charts
      setPlatformData({
        instagram: {
          active: (unified?.instagram?.autopilotEnabled) || status.autopilotEnabled || false,
          todayPosts: 0, // Enhanced with real data later
          reach: igReach || 0,
          engagement: (typeof igEngagementVal === 'number' ? igEngagementVal / 100 : 0)
        },
        youtube: {
          active: (unified?.youtube?.autopilotEnabled) || status.autopilotEnabled || false,
          todayPosts: 0, // Enhanced with real data later
          reach: ytViews || 0,
          engagement: 0 // YouTube engagement calculated differently
        }
      });

      // If unified had extras (optional)
      if (unified?.upcomingPosts?.length) {
        setQueuedPosts(unified.upcomingPosts);
        setQueueSize(unified.upcomingPosts.length);
      }
      if (unified?.credentials) setCredentialsDebug(unified.credentials);

      console.log('✅ [DASHBOARD] Stats updated with real data');
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 [DEV] Analytics debug:', { ig, yt, unified });
      }

    } catch (err) {
      console.error('❌ Failed to load analytics:', err);
      setAnalyticsError((err as Error)?.message || 'Failed to load analytics');
      // Don't show notifications for analytics failures to avoid spam
    } finally {
      setAnalyticsLoading(false);
    }
  }, [status.maxPosts]);

  // ✅ NEW: Check for new autopilot activities and show notifications - DISABLED
  // const checkAutopilotNotifications = useCallback(async () => {
  //   if (!notificationHandler) return;
  //   
  //   try {
  //     // Get recent activity to check for new posts
  //     const res = await fetch('http://localhost:3002/api/activity/feed?limit=20');
  //     if (res.ok) {
  //       const data = await res.json();
  //       const activities = data.data || [];
  //       
  //       // Filter activities from the last 2 minutes
  //       const recentActivities = activities.filter((activity: any) => {
  //         const activityTime = new Date(activity.timestamp || activity.createdAt).getTime();
  //         return activityTime > lastAutopilotCheck;
  //       });
  //       
  //       // Show notifications for recent activities
  //       recentActivities.forEach((activity: any) => {
  //         const platform = activity.platform;
  //         const type = activity.type || 'post';
  //         const status = activity.status;
  //         
  //         if (type === 'post' && status === 'success') {
  //           // ✅ Success notifications disabled to prevent spam
  //           // if (platform === 'instagram') {
  //           //   notificationHandler('✅ Video posted to Instagram', 'success');
  //           // } else if (platform === 'youtube') {
  //           //   notificationHandler('✅ Video posted to YouTube', 'success');
  //           // }
  //         } else if (status === 'failed') {
  //           notificationHandler(`❌ Failed to post to ${platform}`, 'error');
  //         } else if (type === 'repost' && activity.message?.includes('already posted')) {
  //           notificationHandler('🧠 Skipped – Already posted in last 30 days', 'info');
  //         } else if (type === 'storage_check' && status === 'warning') {
  //           notificationHandler('⚠️ Storage warning – check S3/Mongo', 'error');
  //         }
  //       });
  //       
  //       setLastAutopilotCheck(Date.now());
  //     }
  //   } catch (error) {
  //     console.warn('⚠️ Could not check autopilot notifications:', error);
  //   }
  // }, [notificationHandler, lastAutopilotCheck]);

  // ✅ Comprehensive refresh function for all dashboard data
  const refreshAllData = useCallback(async () => {
    try {
      console.log('🔄 Refreshing all dashboard data...');
      
      // Refresh activity feed
      const posts = await fetchEnhancedActivity();
      setEnhancedActivity(posts);
      
      // Refresh queued posts
      await fetchQueuedPosts();
      
      // Check for autopilot notifications - DISABLED
      // await checkAutopilotNotifications();
      
      // Refresh analytics
      await fetchAnalytics();
      
      // Refresh status/settings
      try {
        const res = await fetch(API_ENDPOINTS.settings());
        if (res.ok) {
          const data = await res.json();
          setStatus({
            autopilotEnabled: data.autopilotEnabled || false,
            manual: data.manual !== false,
            maxPosts: data.maxPosts || 3,
            postTime: data.postTime || '14:00',
            repostDelay: data.repostDelay || 1
          });
          
          // ✅ Update platform settings for ChartLines
          if (data.autopilotPlatforms) {
            setPlatformSettings({
              instagram: data.autopilotPlatforms.instagram || false,
              youtube: data.autopilotPlatforms.youtube || false
            });
          }

          // ✅ Update credentials debug info for dashboard display
          setCredentialsDebug({
            'Instagram Token': data.instagramToken ? '✅ Configured' : '❌ Missing',
            'IG Business ID': data.igBusinessId ? '✅ Configured' : '❌ Missing',
            'Facebook Page': data.facebookPage ? '✅ Configured' : '❌ Missing',
            'YouTube Client ID': data.youtubeClientId ? '✅ Configured' : '❌ Missing',
            'YouTube Client Secret': data.youtubeClientSecret ? '✅ Configured' : '❌ Missing',
            'YouTube Access Token': data.youtubeAccessToken ? '✅ Configured' : '❌ Missing',
            'YouTube Refresh Token': data.youtubeRefreshToken ? '✅ Configured' : '❌ Missing',
            'YouTube Channel ID': data.youtubeChannelId ? '✅ Configured' : '❌ Missing',
            'OpenAI API Key': data.openaiApiKey ? '✅ Configured' : '❌ Missing',
            'S3 Access Key': data.s3AccessKey ? '✅ Configured' : '❌ Missing',
            'S3 Secret Key': data.s3SecretKey ? '✅ Configured' : '❌ Missing',
            'S3 Bucket Name': data.s3BucketName ? '✅ Configured' : '❌ Missing',
            'S3 Region': data.s3Region ? '✅ Configured' : '❌ Missing',
            'MongoDB URI': data.mongoURI ? '✅ Configured' : '❌ Missing',
            'Dropbox Token': data.dropboxToken ? '✅ Configured' : '❌ Missing',
            'Runway API Key': data.runwayApiKey ? '✅ Configured' : '❌ Missing'
          });
        }
      } catch (settingsError) {
        console.warn('⚠️ Settings refresh failed:', settingsError);
      }
      
      console.log('✅ All dashboard data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh dashboard data:', error);
    }
  }, []);
  



  // ✅ NEW: Fetch queued/upcoming AutoPilot posts
  const fetchQueuedPosts = useCallback(async () => {
    try {
      console.log('🔍 Fetching upcoming AutoPilot posts...');
      const res = await fetch(API_ENDPOINTS.autopilotQueue(3));
      if (res.ok) {
        const data = await res.json();
        const posts = data.posts || [];
        console.log('📅 Upcoming posts:', posts);
        setQueuedPosts(posts);
        return posts;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch queued posts:', error);
      setQueuedPosts([]);
    }
    return [];
  }, []);

  // ✅ NEW: Enhanced activity fetch function
  const fetchEnhancedActivity = useCallback(async () => {
    try {
      // ✅ NEW: Get reactive chart data first
      const chartRes = await fetch(API_ENDPOINTS.chartStatus());
      if (chartRes.ok) {
        const chartData = await chartRes.json();
        console.log('🔥 Chart reactive data:', chartData);
        
        // Update reactive states for chart behavior
        setEngagementScore(chartData.engagementScore || 0.65);
        setAutopilotRunning(chartData.autopilotRunning || false);
        setNewHighScore(chartData.newHighScore || false);
        setLastPostSpike(chartData.lastPostTime);
        
        // ✅ NEW: Update platform data for hearts
        if (chartData.platformData) {
          setPlatformData({
            instagram: {
              active: chartData.platformData.instagram?.active || false,
              todayPosts: chartData.platformData.instagram?.todayPosts || 0,
              reach: chartData.platformData.instagram?.reach || 0,
              engagement: engagementScore // Use global engagement score
            },
            youtube: {
              active: chartData.platformData.youtube?.active || false,
              todayPosts: chartData.platformData.youtube?.todayPosts || 0,
              reach: chartData.platformData.youtube?.reach || 0,
              engagement: engagementScore // Use global engagement score
            }
          });

          // Extra visual flags
          setTrendingFlags({
            instagram: !!(chartData.platformData.instagram?.trending || chartData.platformData.instagram?.trendingAudio),
            youtube: !!(chartData.platformData.youtube?.trending || chartData.platformData.youtube?.trendingAudio),
          });
          setLastPostSpikeByPlatform({
            instagram: chartData.platformData.instagram?.lastPostTime || null,
            youtube: chartData.platformData.youtube?.lastPostTime || null,
          });
        }
        
        if (chartData.settings) {
          setAutopilotVolume(chartData.settings.dailyPostLimit || 3);
        }
      }
    } catch (error) {
      console.warn('⚠️ Chart status not available');
    }
    
    try {
      // Try the main activity endpoint first
      const res = await fetch(API_ENDPOINTS.activityFeed(20));
      if (res.ok) {
        const data = await res.json();
        const posts = data.data || [];
        console.log('📊 Enhanced activity data:', posts.slice(0, 3)); // Debug
        return posts;
      }
    } catch (error) {
      console.warn('⚠️ Enhanced activity not available, trying autopilot endpoint...');
    }
    
    try {
      // Try the new autopilot-specific activity endpoint
      const autopilotRes = await fetch(API_ENDPOINTS.activityFeed(20));
      if (autopilotRes.ok) {
        const autopilotData = await autopilotRes.json();
        const posts = autopilotData.posts || [];
        console.log('📊 Autopilot activity data:', posts.slice(0, 3)); // Debug
        return posts;
      }
    } catch (autopilotError) {
      console.warn('⚠️ Autopilot activity endpoint not available, using final fallback...');
    }
    
    // No more fallbacks - use existing activity data
    console.warn('⚠️ All activity endpoints failed, using empty data');
    
    return [];
  }, []);

  // Helper function to format activity data
  const formatActivity = (activity: Record<string, unknown>) => {
    const timeAgo = getTimeAgo(activity.createdAt as string | Date);
    console.log(`🕒 Activity ${activity.type}: ${activity.createdAt} -> ${timeAgo}`);
    
    let title = '';
    let icon = '📊';
    
    switch (activity.type) {
      case 'scrape':
        title = `Scraped ${activity.postsProcessed} Instagram posts`;
        icon = '🔍';
        break;
      case 'schedule':
        title = `Queued ${activity.postsSuccessful} videos for posting`;
        icon = '📅';
        break;
      case 'repost':
        if ((activity.postsSuccessful as number) > 0) {
          title = `Posted ${activity.postsSuccessful} videos successfully`;
          icon = '✅';
        } else {
          title = 'Checked for posts to publish';
          icon = '🔄';
        }
        break;
      default:
        title = `${activity.type} completed`;
        icon = '📊';
    }
    
    return { title, icon, timeAgo };
  };

  // Helper function to get time ago
  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const activityDate = new Date(date);
    
    // Validate the date
    if (isNaN(activityDate.getTime())) {
      return 'Unknown time';
    }
    
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Handle negative time differences (future dates)
    if (diffMs < 0) return 'Just now';
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    // For older dates, show actual date
    return activityDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const instagramCanvasRef = useRef<HTMLCanvasElement>(null);
  const youtubeCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Load settings and analytics from backend on component mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(API_ENDPOINTS.settings())
        if (res.ok) {
          const data = await res.json()
          setStatus({
            autopilotEnabled: data.autopilotEnabled || false,
            manual: data.manual !== false,
            maxPosts: data.maxPosts || 3,
            postTime: data.postTime || '14:00',
            repostDelay: data.repostDelay || 1
          })
          // Update connected flags from settings as fallback (masked values still truthy)
          setConnected({
            instagram: !!data.instagramToken && !!data.igBusinessId,
            youtube: !!(data.youtubeAccessToken || (data.youtubeClientId && data.youtubeClientSecret && data.youtubeRefreshToken))
          })

          // ✅ Load credentials info for dashboard display
          setCredentialsDebug({
            'Instagram Token': data.instagramToken ? '✅ Configured' : '❌ Missing',
            'IG Business ID': data.igBusinessId ? '✅ Configured' : '❌ Missing',
            'Facebook Page': data.facebookPage ? '✅ Configured' : '❌ Missing',
            'YouTube Client ID': data.youtubeClientId ? '✅ Configured' : '❌ Missing',
            'YouTube Client Secret': data.youtubeClientSecret ? '✅ Configured' : '❌ Missing',
            'YouTube Access Token': data.youtubeAccessToken ? '✅ Configured' : '❌ Missing',
            'YouTube Refresh Token': data.youtubeRefreshToken ? '✅ Configured' : '❌ Missing',
            'YouTube Channel ID': data.youtubeChannelId ? '✅ Configured' : '❌ Missing',
            'OpenAI API Key': data.openaiApiKey ? '✅ Configured' : '❌ Missing',
            'S3 Access Key': data.s3AccessKey ? '✅ Configured' : '❌ Missing',
            'S3 Secret Key': data.s3SecretKey ? '✅ Configured' : '❌ Missing',
            'S3 Bucket Name': data.s3BucketName ? '✅ Configured' : '❌ Missing',
            'S3 Region': data.s3Region ? '✅ Configured' : '❌ Missing',
            'MongoDB URI': data.mongoURI ? '✅ Configured' : '❌ Missing',
            'Dropbox Token': data.dropboxToken ? '✅ Configured' : '❌ Missing',
            'Runway API Key': data.runwayApiKey ? '✅ Configured' : '❌ Missing'
          })
        } else {
          console.warn('⚠️ No settings found, using defaults.')
        }

        // ✅ NEW: Fetch enhanced activity data and generate chart
        try {
          const posts = await fetchEnhancedActivity();
          setEnhancedActivity(posts);

          // Generate chart data for last 7 days
          const today = new Date();
          const last7 = [...Array(7)].map((_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            return d.toISOString().split('T')[0];
          }).reverse();

          const counts = { instagram: {}, youtube: {} } as any;
          last7.forEach(date => {
            counts.instagram[date] = 0;
            counts.youtube[date] = 0;
          });

          // Process enhanced activity data for chart
          posts.forEach((post: any) => {
            const date = new Date(post.startTime || post.timestamp).toISOString().split('T')[0];
            if (last7.includes(date)) {
              const platform = post.platform || 'unknown';
              if (platform === 'instagram' || platform.includes('instagram')) {
                counts.instagram[date]++;
              }
              if (platform === 'youtube' || platform.includes('youtube')) {
                counts.youtube[date]++;
              }
            }
          });

          // 🔥 Create reactive chart data based on specifications
          const createReactiveData = (platform: 'instagram' | 'youtube', baseCounts: number[]) => {
            // ✅ Line Height Logic: AutoPilot status affects baseline
            let baseValue;
            if (!autopilotRunning) {
              // AutoPilot OFF: lines near bottom (low values)
              baseValue = 0.5; // Start near bottom
            } else {
              // AutoPilot ON: height based on daily post limit
              const heightRatio = Math.min(autopilotVolume / 10, 0.8); // Max 80% of scale
              baseValue = 1 + (heightRatio * 8); // Scale 1-9 based on volume
            }

            // 🔥 Engagement-Based Wave Enhancement
            const engagementMultiplier = autopilotRunning ? (0.5 + engagementScore * 1.5) : 0.3;
            
            // Apply reactive behavior to data points
            return baseCounts.map(count => {
              const enhancedValue = baseValue + (count * engagementMultiplier);
              return Math.max(enhancedValue, 0.1); // Minimum visibility
            });
          };

          // ⚡ Special Effects for New High Score
          const glowIntensity = newHighScore ? 20 : 0;
          const lineThickness = newHighScore ? 6 : 4; // 2px → 4px → 6px for extra glow

          // 📊 Create enhanced chart data
          setChartData({
            labels: last7.map(date => {
              const d = new Date(date);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [
              {
                label: 'Instagram',
                data: createReactiveData('instagram', last7.map(date => counts.instagram[date])),
                borderColor: newHighScore ? '#ff69b4' : 'hotpink', // Brighter when glowing
                backgroundColor: `rgba(255, 105, 180, ${newHighScore ? 0.2 : 0.1})`,
                borderWidth: lineThickness,
                tension: 0.4 + (engagementScore * 0.3), // Smoother with higher engagement
                pointRadius: newHighScore ? 8 : 6,
                pointBackgroundColor: newHighScore ? '#ff1493' : 'hotpink',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: true,
                shadowOffsetX: glowIntensity,
                shadowOffsetY: glowIntensity,
                shadowBlur: glowIntensity,
                shadowColor: 'rgba(255, 105, 180, 0.6)',
              },
              {
                label: 'YouTube',
                data: createReactiveData('youtube', last7.map(date => counts.youtube[date])),
                borderColor: newHighScore ? '#ff0000' : 'red', // Brighter when glowing
                backgroundColor: `rgba(255, 0, 0, ${newHighScore ? 0.2 : 0.1})`,
                borderWidth: lineThickness,
                tension: 0.4 + (engagementScore * 0.3), // Smoother with higher engagement
                pointRadius: newHighScore ? 8 : 6,
                pointBackgroundColor: newHighScore ? '#cc0000' : 'red',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: true,
                shadowOffsetX: glowIntensity,
                shadowOffsetY: glowIntensity,
                shadowBlur: glowIntensity,
                shadowColor: 'rgba(255, 0, 0, 0.6)',
              },
            ]
          });

          console.log('📊 Chart data generated:', counts);
        } catch (enhancedErr) {
          console.warn('⚠️ Enhanced activity failed, trying fallback...');
        }

       // Use API for autopilot status for real-time data
        try {
          const autopilotRes = await fetch(API_ENDPOINTS.autopilotStatus())
          if (autopilotRes.ok) {
            const autopilotData = await autopilotRes.json()
            console.log('📊 Phase 9 Autopilot Status:', autopilotData)
            setAutopilotRunning(autopilotData.autopilotEnabled || false)
            
            // Update queue size from autopilot data
            if (autopilotData.queueCount !== undefined) {
              setQueueSize(autopilotData.queueCount || 0)
            }
          }
        } catch (autopilotErr) {
          console.warn('⚠️ Phase 9 autopilot status not available:', autopilotErr)
        }
      } catch (err) {
        console.error('❌ Failed to load settings for dashboard:', err)
      }
    }



    fetchStatus();
    fetchAnalytics();
    
    // ✅ Enhanced periodic refresh for real-time updates
    const statusInterval = setInterval(fetchStatus, 30000); // Every 30 seconds for live metrics
    
    // ✅ Additional refresh for activity feed every 60 seconds
    const activityInterval = setInterval(async () => {
      try {
        const posts = await fetchEnhancedActivity();
        setEnhancedActivity(posts);
        console.log('🔄 Activity feed auto-refreshed');
      } catch (error) {
        console.warn('⚠️ Activity feed auto-refresh failed:', error);
      }
    }, 60000); // Every 60 seconds
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(activityInterval);
    };
  }, [])

  useEffect(() => {
    // Update stats when status changes
    setStats(prevStats => ({
      ...prevStats,
      instagram: {
        ...prevStats.instagram,
        autoPostsPerDay: `${status.maxPosts}/day`
      }
    }));
  }, [status]);

  useEffect(() => {
    // Create particles
    const createParticles = () => {
      if (!particlesRef.current) return;
      
      // Clear existing particles
      particlesRef.current.innerHTML = '';
      
      // Create 20 particles
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${currentPlatform}`;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesRef.current.appendChild(particle);
      }
    };

    createParticles();
  }, [currentPlatform]);

  useEffect(() => {
    // Draw charts
    const drawChart = (canvas: HTMLCanvasElement | null, platform: string) => {
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      let animationFrame = 0;
      
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 10; i++) {
          const y = (canvas.height / 10) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        
        // Calculate pulse effects per platform
        const pData = platform === 'youtube' ? platformData.youtube : platformData.instagram;
        const pTrending = platform === 'youtube' ? trendingFlags.youtube : trendingFlags.instagram;
        const pSpikeTime = platform === 'youtube' ? lastPostSpikeByPlatform.youtube : lastPostSpikeByPlatform.instagram;
        const recentSpike = pSpikeTime ? (Date.now() - Number(pSpikeTime) < 6000) : false;
        const spikeWave = recentSpike ? Math.sin(animationFrame * 0.6) * 0.6 : 0;
        const queueIntensity = Math.min(queueSize / 10, 1);
        const volumeIntensity = Math.min(autopilotVolume / 5, 1);
        const engagementIntensity = Math.max(0, Math.min(pData.engagement || 0, 1));
        const activeBoost = pData.active ? 0.5 : 0.1;
        const trendingBoost = pTrending ? 0.3 : 0;
        const runningGlow = (pData.active ? 0.3 : 0) + (pTrending ? 0.2 : 0);
        const burstEffect = spikeWave || (Date.now() - lastQueueUpdate < 5000 ? Math.sin(animationFrame * 0.5) * 0.5 : 0);

        // Enhanced wave intensity per platform based on engagement, volume, activity, trending
        const baseAmplitude = 30;
        const combinedIntensity = Math.max(queueIntensity, volumeIntensity, engagementIntensity) + activeBoost + trendingBoost;
        const queueAmplitude = baseAmplitude * (0.4 + combinedIntensity * 0.8);
        const secondaryAmplitude = 18 * (0.5 + combinedIntensity * 0.7);
        
        // Draw animated line with dynamic intensity and speed per platform
        const points: {x:number; y:number}[] = [];
        const baseSpeed = 0.04;
        const volumeSpeed = Math.min(autopilotVolume * 0.03, 0.12);
        const activitySpeed = pData.active ? 0.03 : 0.0;
        const spikeSpeed = recentSpike ? 0.05 : 0;
        const animationSpeed = baseSpeed + volumeSpeed + activitySpeed + spikeSpeed;
        
        for (let i = 0; i <= 100; i++) {
          const x = (canvas.width / 100) * i;
          const y = canvas.height / 2 + 
                   Math.sin((i + animationFrame) * animationSpeed * 2) * queueAmplitude + 
                   Math.sin((i + animationFrame) * animationSpeed) * secondaryAmplitude;
          points.push({x, y});
        }
        
        // Add glow effect when platform is active/trending or recent spike
        if (pData.active || pTrending || burstEffect > 0) {
          const glowIntensity = runningGlow + Math.abs(burstEffect);
          ctx.shadowColor = platform === 'youtube' ? '#ff0000' : '#e1306c';
          ctx.shadowBlur = 20 * glowIntensity;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
        
        // Platform-specific gradient with dynamic opacity based on volume
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        const opacity = 0.7 + (combinedIntensity * 0.25) + runningGlow;
        
        if (platform === 'youtube') {
          gradient.addColorStop(0, `rgba(255, 0, 0, ${opacity})`);
          gradient.addColorStop(0.5, `rgba(255, 68, 68, ${opacity})`);
          gradient.addColorStop(1, `rgba(204, 0, 0, ${opacity})`);
        } else {
          gradient.addColorStop(0, `rgba(255, 68, 88, ${opacity})`);
          gradient.addColorStop(0.5, `rgba(225, 48, 108, ${opacity})`);
          gradient.addColorStop(1, `rgba(131, 58, 180, ${opacity})`);
        }
        
        ctx.strokeStyle = gradient;
        // Dynamic line width per platform
        const baseLineWidth = 2.5;
        const volumeLineWidth = Math.min(autopilotVolume * 1.4, 5);
        const activeWidth = pData.active ? 1.2 : 0;
        const trendingWidth = pTrending ? 0.8 : 0;
        ctx.lineWidth = baseLineWidth + volumeLineWidth + (combinedIntensity * 1.6) + activeWidth + trendingWidth;
        ctx.beginPath();
        
        points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        
        ctx.stroke();
        
        // Add particle burst effect for new content
        if (burstEffect > 0) {
          const particleCount = Math.floor(queueSize / 2) + 3;
          for (let p = 0; p < particleCount; p++) {
            const px = Math.random() * canvas.width;
            const py = Math.random() * canvas.height;
            const size = Math.random() * 3 + 1;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(burstEffect) * 0.8})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Reset shadow for next frame
        ctx.shadowBlur = 0;
        
        animationFrame += 0.5;
        requestAnimationFrame(animate);
      };
      
      animate();
    };

    drawChart(instagramCanvasRef.current, 'instagram');
    drawChart(youtubeCanvasRef.current, 'youtube');
  }, [autopilotRunning, queueSize, lastQueueUpdate]);

  const switchPlatform = async (platform: string) => {
    try {
      console.log(`Switching to ${platform}`);
      setCurrentPlatform(platform);
      
      // ✅ Check if this platform is active in autopilot settings
      try {
        const settingsRes = await fetch(API_ENDPOINTS.settings());
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          const platformActive = settings.autopilotPlatforms?.[platform] !== false;
          
          if (!platformActive) {
            showNotification(`⚠️ ${platform.charAt(0).toUpperCase() + platform.slice(1)} is currently disabled in autopilot settings`, 'error');
          } else {
            showNotification(`📱 Switched to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
          }
        } else {
          showNotification(`📱 Switched to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        }
      } catch (settingsError) {
        console.warn('Could not check platform settings:', settingsError);
        showNotification(`📱 Switched to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
      }
    } catch (error) {
      console.error('Error switching platform:', error);
      showNotification('❌ Error switching platform', 'error');
    }
  };

  const toggleMenu = () => {
    try {
      setMenuOpen(!menuOpen);
    } catch (error) {
      console.error('Error toggling menu:', error);
    }
  };



  const handleMenuClick = (action: string) => {
    try {
      console.log('Menu action:', action);
      
      // Close menu first
      setMenuOpen(false);
      
      // Handle menu actions
      switch (action) {
        case 'zillow':
          window.location.href = '/zillow';
          showNotification('🏡 Opening Zillow Assistant...');
          break;
        case 'autopilot-page':
          // Navigate to AutoPilot dashboard page
          window.location.href = '/autopilot';
          showNotification('🚀 Opening AutoPilot Dashboard...');
          break;
        case 'settings':
          // Navigate to settings page
          window.location.href = '/settings';
          showNotification('⚙️ Opening Settings...');
          break;
        case 'diagnostics':
          window.location.href = '/diagnostics';
          showNotification('📊 Opening Diagnostics...');
          break;
        default:
          console.warn('Unknown menu action:', action);
          showNotification('❌ Unknown action: ' + action, 'error');
          break;
      }
    } catch (error) {
      console.error('Error handling menu click:', error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    try {
      // Create a temporary notification
      const notification = document.createElement('div');
      const bgColor = type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                     type === 'info' ? 'rgba(59, 130, 246, 0.9)' : 
                     'rgba(34, 197, 94, 0.9)';
      
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        z-index: 10000;
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-weight: 500;
        max-width: 300px;
      `;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }, 3000);
      
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const handleControlBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const parent = e.currentTarget.parentElement;
      if (parent) {
        const activeBtn = parent.querySelector('.control-btn.active');
        if (activeBtn) {
          activeBtn.classList.remove('active');
        }
        e.currentTarget.classList.add('active');
      }
      
      showNotification(`📊 Chart period changed to ${e.currentTarget.textContent}`);
    } catch (error) {
      console.error('Error handling control button click:', error);
    }
  };

  // Manual Post Now handler
  const handleManualPostNow = async () => {
    if (manualPostRunning) return; // Prevent double clicks
    
    setManualPostRunning(true);
    
    try {
              const response = await fetch(API_ENDPOINTS.autopilotManualPost(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      
      if (result.success) {
        showNotification('✅ Posted successfully!', 'success');
        // Refresh data
        fetchAnalytics();
        fetchEnhancedActivity();
      } else {
        showNotification('❌ Post failed', 'error');
      }
    } catch (error) {
      showNotification('❌ Connection error', 'error');
    }
    
    // Reset button after 2 seconds
    setTimeout(() => {
      setManualPostRunning(false);
    }, 2000);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const menuContainer = document.querySelector('.menu-container');
      if (!menuContainer?.contains(e.target as Node) && menuOpen) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
      if (e.key === '1' && e.ctrlKey) {
        e.preventDefault();
        switchPlatform('instagram');
      }
      if (e.key === '2' && e.ctrlKey) {
        e.preventDefault();
        switchPlatform('youtube');
      }
      if (e.key === 'u' && e.ctrlKey) {
        e.preventDefault();
        handleMenuClick('upload');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // ✅ NEW: Real-time notification checking (every 10 seconds) - DISABLED
  // useEffect(() => {
  //   if (!notificationHandler) return;
  //   
  //   // Initialize check timestamp only once
  //   setLastAutopilotCheck(prev => prev === 0 ? Date.now() - 60000 : prev);
  //   
  //   // More frequent notification checking
  //   const notificationInterval = setInterval(checkAutopilotNotifications, 10000);
  //   
  //   return () => clearInterval(notificationInterval);
  // }, [notificationHandler]);

  return (
    <div suppressHydrationWarning>
      {!isMounted ? null : (<>
      <div className="floating-particles" ref={particlesRef}></div>
      <div className={`menu-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)}></div>
      
      {/* ✅ NEW: Real-time notifications for AutoPilot events - DISABLED */}
      {/* <NotificationSystem onShowNotification={handleNotificationSetup} /> */}
      
      <div className="dashboard-container">
        <header className="header">
          <div className="platform-switcher">
            <button 
              className={`platform-btn instagram ${currentPlatform === 'instagram' ? 'active' : ''}`}
              onClick={() => switchPlatform('instagram')}
            >
              📷 Instagram
            </button>
            <button 
              className={`platform-btn youtube ${currentPlatform === 'youtube' ? 'active' : ''}`}
              onClick={() => switchPlatform('youtube')}
            >
              ▶️ YouTube
            </button>
          </div>

          <div className="logo">Lifestyle Design Social</div>
          
          <div className="header-right">
            <div className="menu-container">
              <div className={`menu-btn ${menuOpen ? 'active' : ''}`} onClick={toggleMenu}>
                <span className="menu-icon">⋮</span>
              </div>
              <div className={`dropdown-menu ${menuOpen ? 'show' : ''}`}>
                {/* Zillow Assistant entry removed per request */}
                <div className="menu-item" onClick={() => handleMenuClick('autopilot-page')}>
                  <div className="menu-item-icon">🚀</div>
                  <span>AutoPilot Dashboard</span>
                </div>
                <div className="menu-item" onClick={() => handleMenuClick('settings')}>
                  <div className="menu-item-icon">⚙</div>
                  <span>Settings</span>
                </div>
                <div className="menu-item" onClick={() => handleMenuClick('diagnostics')} data-testid="menu-diagnostics">
                  <div className="menu-item-icon">📊</div>
                  <span>Diagnostics</span>
                </div>
              </div>
            </div>

            <div className="user-profile">
              <div className="avatar">SM</div>
              <div className="status-indicator"></div>
            </div>
          </div>
        </header>



        {/* Notifications */}
        {/* Lightweight toast system */}
        <NotificationSystem />

        {/* Instagram Data */}
        <div id="instagram-data" className={`platform-data ${currentPlatform === 'instagram' ? 'active' : ''}`}>
          {/* Loading / Error banner */}
          {analyticsLoading && (
            <div style={{ background: '#222', color: '#aaa', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>Loading analytics…</div>
          )}
          {analyticsError && (
            <div style={{ background: '#3a1d1d', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Analytics error: {analyticsError}</span>
              <button onClick={() => (window.location.href = '/settings')} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Open Settings</button>
            </div>
          )}
          <div className="metrics-grid">
            <div className="metric-card" title={connected.instagram ? 'Connected' : 'Connect in Settings'} style={{ opacity: connected.instagram ? 1 : 0.6 }}>
              <div className="metric-header">
                <span className="metric-title">Followers</span>
                <div className="metric-icon">👥</div>
              </div>
              <div className="metric-value">{stats.instagram.followers}{connected.instagram ? '' : ' '}</div>
              <div className="metric-change change-positive">
                {connected.instagram ? 'Connected' : 'Not Connected'}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Engagement Rate</span>
                <div className="metric-icon">❤️</div>
              </div>
              <div className="metric-value">{stats.instagram.engagement}</div>
              <div className="metric-change change-positive">
                ↗ +0.8% from last post
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Reach</span>
                <div className="metric-icon">📊</div>
              </div>
              <div className="metric-value">{stats.instagram.reach}</div>
              <div className="metric-change change-positive">
                ↗ +12.4% today
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Auto-Post Status</span>
                <div className={`auto-post-status ${autopilotStatus === 'error' ? 'inactive' : ''}`}>
                  <div className={`status-indicator ${autopilotStatus === 'running' ? 'pulsing' : ''}`}></div>
                  {autopilotStatus === 'running' ? 'Running...' :
                   autopilotStatus === 'success' ? 'Posted!' :
                   autopilotStatus === 'error' ? 'Failed' :
                   status.autopilotEnabled ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="metric-value">{status.maxPosts}/day</div>
              <div className="metric-change">
                Next post at {status.postTime} (delay: {status.repostDelay}d)
              </div>
            </div>
          </div>

          <div className="grid-layout" style={{ width: 'min(1100px, 100vw - 32px)', margin: '0 auto' }}>
            {/* 🌊 Animated Wave Chart - Reactive to Autopilot Data */}
            <DashboardChart />
            {/* Timeseries line chart */}
            {timeseries && (
              <div style={{ background: '#121212', borderRadius: 12, padding: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ color: '#fff' }}>Last {timeseries.labels.length} days (CT)</strong>
                  <label style={{ color: '#ddd', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={showSeries.combined} onChange={(e) => setShowSeries(s => ({ ...s, combined: e.target.checked }))} /> Combined
                  </label>
                  <label style={{ color: '#e1306c', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={showSeries.instagram} onChange={(e) => setShowSeries(s => ({ ...s, instagram: e.target.checked }))} /> IG
                  </label>
                  <label style={{ color: 'red', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={showSeries.youtube} onChange={(e) => setShowSeries(s => ({ ...s, youtube: e.target.checked }))} /> YT
                  </label>
                </div>
                <Line
                  data={{
                    labels: timeseries.labels,
                    datasets: [
                      showSeries.combined ? { label: 'Combined', data: timeseries.combined, fill: false, borderColor: '#60a5fa', backgroundColor: '#60a5fa', tension: 0.3 } : undefined,
                      showSeries.instagram ? { label: 'Instagram', data: timeseries.instagram, fill: false, borderColor: '#e1306c', backgroundColor: '#e1306c', tension: 0.3 } : undefined,
                      showSeries.youtube ? { label: 'YouTube', data: timeseries.youtube, fill: false, borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.3 } : undefined,
                    ].filter(Boolean) as any
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { labels: { color: '#eee' } } },
                    scales: {
                      x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                      y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.06)' } }
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Move heatmap below to give wave chart full horizontal space */}
          <div style={{ marginTop: '20px' }}>
            <ActivityHeatmap />
          </div>

          {/* 🚀 Manual Post Control Panel (YouTube) */}
          <div className="manual-post-panel pro" style={{
            marginTop: '32px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            width: '100%',
            maxWidth: '1100px',
            marginLeft: 'auto',
            marginRight: 'auto',
            position: 'relative',
            zIndex: 2,
            padding: '0 16px'
          }}>
            <button
              onClick={handleManualPostNow}
              disabled={manualPostRunning}
              className={`manual-post-button-pro ${manualPostRunning ? 'disabled' : ''}`}
            >
              {manualPostRunning ? (
                <>
                  <span className="spinner" />
                  Posting...
                </>
              ) : (
                <>
                  ⚡ Post Now
                </>
              )}
            </button>
            <style jsx>{`
              .manual-post-button-pro {
                --glow: rgba(225, 48, 108, 0.55);
                --start: #ff2e88;
                --end: #ff9950;
                background: linear-gradient(135deg, var(--start), var(--end));
                color: #ffffff;
                border: 1px solid rgba(255,255,255,0.18);
                padding: 14px 28px;
                font-size: 17px;
                font-weight: 800;
                letter-spacing: 0.3px;
                border-radius: 12px;
                box-shadow: 0 10px 30px var(--glow), inset 0 0 12px rgba(255,255,255,0.08);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                position: relative;
                overflow: hidden;
                transition: transform 180ms ease, box-shadow 200ms ease, filter 200ms ease;
                text-transform: uppercase;
              }
              .manual-post-button-pro:hover { transform: translateY(-2px) scale(1.02); filter: saturate(115%); box-shadow: 0 16px 40px var(--glow); }
              .manual-post-button-pro:active { transform: translateY(0) scale(0.99); }
              .manual-post-button-pro.disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(10%); }
              .manual-post-button-pro::after {
                content: '';
                position: absolute;
                top: 0; left: -120%;
                width: 120%; height: 100%;
                background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
                transform: skewX(-20deg);
                animation: shine 3.2s ease-in-out infinite;
              }
              @keyframes shine { 0%{ left: -120%; } 60%{ left: 140%; } 100%{ left: 140%; } }
              .spinner {
                width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.6); border-top-color: #fff; border-radius: 50%; display: inline-block;
                animation: spin 1s linear infinite;
              }
              @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
            `}</style>
          </div>

          <div className="grid-layout">
            {/* ✅ Recent AutoPilot Posts Component - positioned under lines graph */}
            <RecentAutoPilotPostsWrapper platform="instagram" />
            <div></div>
          </div>
        </div>

        {/* YouTube Data */}
        <div id="youtube-data" className={`platform-data ${currentPlatform === 'youtube' ? 'active' : ''}`}>
          <div className="metrics-grid">
            <div className="metric-card youtube" title={connected.youtube ? 'Connected' : 'Connect in Settings'} style={{ opacity: connected.youtube ? 1 : 0.6 }}>
              <div className="metric-header">
                <span className="metric-title">Subscribers</span>
                <div className="metric-icon youtube">📺</div>
              </div>
              <div className="metric-value youtube">{stats.youtube.subscribers}{connected.youtube ? '' : ' '}</div>
              <div className="metric-change change-positive">
                {connected.youtube ? 'Connected' : 'Not Connected'}
              </div>
            </div>

            <div className="metric-card youtube">
              <div className="metric-header">
                <span className="metric-title">Watch Time</span>
                <div className="metric-icon youtube">⏱️</div>
              </div>
              <div className="metric-value youtube">{stats.youtube.watchTime}</div>
              <div className="metric-change change-positive">
                ↗ +15.7% hours this week
              </div>
            </div>

            <div className="metric-card youtube">
              <div className="metric-header">
                <span className="metric-title">Views</span>
                <div className="metric-icon youtube">👁️</div>
              </div>
              <div className="metric-value youtube">{stats.youtube.views}</div>
              <div className="metric-change change-positive">
                ↗ +8.3% this week
              </div>
            </div>

            <div className="metric-card youtube">
              <div className="metric-header">
                <span className="metric-title">Auto-Upload</span>
                <div className={`auto-post-status ${autopilotStatus === 'error' ? 'inactive' : ''}`}>
                  <div className={`status-indicator ${autopilotStatus === 'running' ? 'pulsing' : ''}`}></div>
                  {autopilotStatus === 'running' ? 'Running...' :
                   autopilotStatus === 'success' ? 'Posted!' :
                   autopilotStatus === 'error' ? 'Failed' :
                   status.autopilotEnabled ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="metric-value youtube">{status.maxPosts}/day</div>
              <div className="metric-change">
                Next upload at {status.postTime} (delay: {status.repostDelay}d)
              </div>
            </div>
          </div>

          <div className="grid-layout" style={{ width: 'min(1100px, 100vw - 32px)', margin: '0 auto', marginTop: 0 }}>
            {/* 🌊 Animated Wave Chart - Reactive to Autopilot Data */}
            <DashboardChart />
          </div>

          {/* Move heatmap below to give wave chart full horizontal space (YouTube) */}
          <div style={{ marginTop: '20px' }}>
            <ActivityHeatmap />
          </div>

          <div className="grid-layout">
            {/* ✅ Recent AutoPilot Posts Component - positioned under lines graph */}
            <RecentAutoPilotPostsWrapper platform="youtube" />
            <div></div>
          </div>
        </div>

        {/* ✨ Audience & Wave Explanations (Unified, per request) */}
        <div className="chart-descriptions" style={{ marginTop: '20px' }}>
          <div className="description-container" style={{ padding: 0 }}>
            <div className="description-grid" style={{ display: 'grid', gap: '12px' }}>
              <div className="description-card" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="description-icon">🔥</div>
                <h4>Activity Level</h4>
                <p>
                  Minimal • Low • Medium • High • Very High • Peak
                </p>
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                  <strong>Peak Time:</strong> Thu–Fri 12–18h<br/>
                  <strong>Optimal Posting:</strong> Weekdays 14:30
                </div>
              </div>

              <div className="description-card" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="description-icon">📊</div>
                <h4>What the Numbers Mean</h4>
                <p>
                  00 = Midnight (12 AM) • 06 = 6 AM • 12 = Noon (12 PM) • 18 = 6 PM • 24 = Midnight again.<br/>
                  So "12-18" means 12 PM to 6 PM (afternoon).
                </p>
                <div style={{ marginTop: 6 }}>
                  <strong>Color System:</strong> Dark Gray = Minimal • Blue = Low • Purple = Medium • Pink = High • Red = Very High • Bright Red = Peak (pulsing)
                </div>
              </div>

              <div className="description-card" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="description-icon">🌊</div>
                <h4>Wave Lines</h4>
                <p>
                  These lines represent AutoPilot activity. Pink = Instagram, Red = YouTube. Lines rise with post volume and engagement. Glows and spikes indicate trending content or recent live posts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 🔑 Credentials Status View */}
        {credentialsDebug && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <h4 style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '14px' }}>
              🔑 API Credentials Status
            </h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {Object.entries(credentialsDebug).map(([key, status]) => (
                <div key={key} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.25rem 0'
                }}>
                  <span style={{ color: '#888' }}>{key}:</span>
                  <span style={{ 
                    color: status === '✅ Configured' ? '#4ade80' : '#f87171',
                    fontWeight: 'bold'
                  }}>
                    {status as string}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.5rem',
              backgroundColor: '#2a2a2a',
              borderRadius: '4px',
              color: '#888',
              fontSize: '11px'
            }}>
              This panel shows the configuration status of your API credentials from MongoDB settings. 
              All credentials are stored securely and only status indicators are displayed here.
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

export default dynamic(() => Promise.resolve(Dashboard), { ssr: false });