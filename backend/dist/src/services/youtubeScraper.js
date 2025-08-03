"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const PostInsights_1 = __importDefault(require("../models/PostInsights"));
const TopHashtags_1 = __importDefault(require("../models/TopHashtags"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class YouTubeScraper {
    constructor(apiKey, channelId, refreshToken) {
        this.apiKey = apiKey;
        this.channelId = channelId;
        this.refreshToken = refreshToken;
    }
    /**
     * Auto-detect channel ID from authenticated user
     */
    async autoDetectChannelId() {
        try {
            // Try to get channel from 'mine' parameter if we have OAuth
            const response = await axios_1.default.get(`https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&key=${this.apiKey}`);
            if (response.data.items && response.data.items.length > 0) {
                const detectedChannelId = response.data.items[0].id;
                console.log(`✅ Auto-detected YouTube Channel ID: ${detectedChannelId}`);
                // Update settings.json with detected channel ID
                await this.updateChannelIdInSettings(detectedChannelId);
                this.channelId = detectedChannelId;
                return detectedChannelId;
            }
            else {
                throw new Error('No channels found for the authenticated user');
            }
        }
        catch (error) {
            console.error('Could not auto-detect channel ID:', error);
            throw new Error('YouTube Channel ID not configured and auto-detection failed. Please set youtubeChannelId in settings.');
        }
    }
    /**
     * Update the channel ID in settings.json
     */
    async updateChannelIdInSettings(channelId) {
        try {
            const settingsPath = path.resolve(__dirname, '../../../settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                settings.youtubeChannelId = channelId;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
                console.log(`✅ Updated settings.json with channel ID: ${channelId}`);
            }
        }
        catch (error) {
            console.warn('Could not update settings.json with channel ID:', error);
        }
    }
    /**
     * Fetch top 500 performing videos from YouTube channel - PHASE 2 ENHANCED
     */
    async scrapeTopPerformingVideos() {
        var _a, _b;
        try {
            console.log('🎯 PHASE 2: Fetching up to 500 YouTube videos for analysis...');
            // First, get all videos from channel (up to 500 recent videos)
            const allVideos = await this.fetchChannelVideos();
            console.log(`📊 Fetched ${allVideos.length} videos from YouTube channel`);
            // Calculate performance scores and sort
            const videosWithScores = allVideos.map(video => ({
                ...video,
                performanceScore: this.calculatePerformanceScore(video)
            }));
            // Sort by performance score and return all (up to 500)
            const topVideos = videosWithScores
                .sort((a, b) => b.performanceScore - a.performanceScore);
            console.log(`✅ Analyzed ${topVideos.length} YouTube videos with performance scores`);
            console.log(`🏆 Top performer: ${(_a = topVideos[0]) === null || _a === void 0 ? void 0 : _a.title} (Score: ${(_b = topVideos[0]) === null || _b === void 0 ? void 0 : _b.performanceScore})`);
            return topVideos;
        }
        catch (error) {
            console.error('Error scraping YouTube videos:', error);
            throw error;
        }
    }
    /**
     * Fetch videos from YouTube channel - ENHANCED for 500 videos
     */
    async fetchChannelVideos() {
        var _a, _b, _c;
        const videos = [];
        let nextPageToken = '';
        let maxResults = 50;
        let totalFetched = 0;
        const targetVideos = 500; // PHASE 2: Increased from 200 to 500
        try {
            // Auto-detect channel ID if needed
            if (this.channelId === 'AUTO_DETECT_ON_NEXT_API_CALL') {
                await this.autoDetectChannelId();
            }
            // Get channel uploads playlist ID
            const channelResponse = await axios_1.default.get(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${this.channelId}&key=${this.apiKey}`);
            const uploadsPlaylistId = (_c = (_b = (_a = channelResponse.data.items[0]) === null || _a === void 0 ? void 0 : _a.contentDetails) === null || _b === void 0 ? void 0 : _b.relatedPlaylists) === null || _c === void 0 ? void 0 : _c.uploads;
            if (!uploadsPlaylistId) {
                throw new Error('Could not find uploads playlist for channel');
            }
            console.log(`🔍 Found uploads playlist: ${uploadsPlaylistId}`);
            // Fetch videos from uploads playlist
            while (totalFetched < targetVideos) {
                const playlistResponse = await axios_1.default.get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&pageToken=${nextPageToken}&key=${this.apiKey}`).then(res => res.data);
                if (!playlistResponse.items || playlistResponse.items.length === 0) {
                    console.log('📝 No more videos found in playlist');
                    break;
                }
                // Get video IDs in batches of 50 (YouTube API limit)
                const videoIds = playlistResponse.items.map(item => item.snippet.resourceId.videoId);
                // Fetch detailed video statistics in batches
                const batchSize = 50;
                for (let i = 0; i < videoIds.length; i += batchSize) {
                    const batchIds = videoIds.slice(i, i + batchSize);
                    try {
                        const videoDetailsResponse = await axios_1.default.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batchIds.join(',')}&key=${this.apiKey}`);
                        // Process video data
                        for (const video of videoDetailsResponse.data.items) {
                            videos.push({
                                videoId: video.id,
                                title: video.snippet.title,
                                description: video.snippet.description || '',
                                publishedAt: video.snippet.publishedAt,
                                viewCount: parseInt(video.statistics.viewCount || '0'),
                                likeCount: parseInt(video.statistics.likeCount || '0'),
                                commentCount: parseInt(video.statistics.commentCount || '0'),
                                thumbnails: video.snippet.thumbnails
                            });
                        }
                    }
                    catch (batchError) {
                        console.warn(`⚠️ Error fetching batch starting at ${i}:`, batchError);
                        continue;
                    }
                }
                totalFetched += playlistResponse.items.length;
                nextPageToken = playlistResponse.nextPageToken || '';
                console.log(`📥 Progress: ${totalFetched}/${targetVideos} videos fetched`);
                if (!nextPageToken) {
                    console.log('📝 Reached end of available videos');
                    break;
                }
                // Add small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            console.log(`✅ Total videos fetched: ${videos.length}`);
            return videos;
        }
        catch (error) {
            console.error('Error fetching YouTube channel videos:', error);
            throw error;
        }
    }
    /**
     * Calculate performance score based on views, likes, comments - ENHANCED ALGORITHM
     */
    calculatePerformanceScore(video) {
        const { viewCount, likeCount, commentCount } = video;
        // PHASE 2 ENHANCED: Weighted scoring algorithm
        // Views (40%), Likes (35%), Comments (25%)
        const viewScore = viewCount * 0.4;
        const likeScore = likeCount * 35; // Weight likes higher per unit
        const commentScore = commentCount * 25; // Weight comments highest per unit
        // Engagement rate bonus (likes + comments relative to views)
        const engagementRate = viewCount > 0 ? (likeCount + commentCount) / viewCount : 0;
        const engagementBonus = engagementRate * 1000; // Bonus for high engagement
        const totalScore = viewScore + likeScore + commentScore + engagementBonus;
        return Math.round(totalScore);
    }
    /**
     * Extract hashtags from video description - ENHANCED
     */
    extractHashtags(description) {
        if (!description)
            return [];
        const hashtagRegex = /#[a-zA-Z0-9_]+/g;
        const hashtags = description.match(hashtagRegex) || [];
        // Clean and normalize hashtags
        return hashtags
            .map(tag => tag.toLowerCase().trim())
            .filter(tag => tag.length > 2) // Filter out very short hashtags
            .slice(0, 30); // Limit to 30 hashtags per video
    }
    /**
     * Save scraped videos to PostInsights collection - PHASE 2 ENHANCED
     */
    async saveVideoInsights(videos) {
        try {
            console.log(`💾 Saving ${videos.length} YouTube video insights to MongoDB...`);
            let savedCount = 0;
            let updatedCount = 0;
            for (const video of videos) {
                const hashtags = this.extractHashtags(video.description);
                const performanceScore = this.calculatePerformanceScore(video);
                // Check if video already exists
                const existingInsight = await PostInsights_1.default.findOne({ videoId: video.videoId });
                if (!existingInsight) {
                    await PostInsights_1.default.create({
                        platform: 'youtube',
                        videoId: video.videoId,
                        caption: video.description || video.title || 'No description available',
                        hashtags,
                        performanceScore,
                        repostEligible: true,
                        reposted: false,
                        originalPostDate: new Date(video.publishedAt),
                        views: video.viewCount,
                        likes: video.likeCount,
                        comments: video.commentCount,
                        title: video.title,
                        scrapedAt: new Date()
                    });
                    savedCount++;
                }
                else {
                    // Update existing record with latest stats
                    await PostInsights_1.default.findByIdAndUpdate(existingInsight._id, {
                        views: video.viewCount,
                        likes: video.likeCount,
                        comments: video.commentCount,
                        performanceScore,
                        hashtags, // Update hashtags in case description changed
                        caption: video.description || video.title || 'No description available',
                        title: video.title,
                        scrapedAt: new Date()
                    });
                    updatedCount++;
                }
            }
            console.log(`✅ Saved ${savedCount} new YouTube insights, updated ${updatedCount} existing records`);
        }
        catch (error) {
            console.error('Error saving YouTube video insights:', error);
            throw error;
        }
    }
    /**
     * Update top hashtags based on scraped videos - PHASE 2 ENHANCED
     */
    async updateTopHashtags() {
        try {
            console.log('🏷️ Updating YouTube hashtag analytics...');
            // Get all YouTube videos from PostInsights
            const youtubeVideos = await PostInsights_1.default.find({ platform: 'youtube' });
            // Aggregate hashtag data
            const hashtagStats = new Map();
            for (const video of youtubeVideos) {
                for (const hashtag of video.hashtags) {
                    if (!hashtagStats.has(hashtag)) {
                        hashtagStats.set(hashtag, {
                            usageCount: 0,
                            totalViews: 0,
                            totalLikes: 0,
                            totalComments: 0,
                            videos: []
                        });
                    }
                    const stats = hashtagStats.get(hashtag);
                    stats.usageCount++;
                    stats.totalViews += video.views || 0;
                    stats.totalLikes += video.likes || 0;
                    stats.totalComments += video.comments || 0;
                    stats.videos.push(video);
                }
            }
            // Update TopHashtags collection
            for (const [hashtag, stats] of Array.from(hashtagStats.entries())) {
                const avgViewScore = stats.usageCount > 0 ? stats.totalViews / stats.usageCount : 0;
                await TopHashtags_1.default.findOneAndUpdate({ hashtag }, {
                    hashtag,
                    usageCount: stats.usageCount,
                    avgViewScore,
                    platform: 'youtube',
                    totalViews: stats.totalViews,
                    totalLikes: stats.totalLikes,
                    lastUpdated: new Date()
                }, { upsert: true, new: true });
            }
            console.log(`✅ Updated ${hashtagStats.size} YouTube hashtags in TopHashtags collection`);
        }
        catch (error) {
            console.error('Error updating YouTube top hashtags:', error);
            throw error;
        }
    }
    /**
     * Full scraping process: fetch videos, save insights, update hashtags - PHASE 2 COMPLETE
     */
    async performFullScrape() {
        try {
            console.log('🚀 Starting YouTube Phase 2 scraping process...');
            // 1. Scrape top performing videos (up to 500)
            const topVideos = await this.scrapeTopPerformingVideos();
            // 2. Save video insights
            await this.saveVideoInsights(topVideos);
            // 3. Update hashtag analytics
            await this.updateTopHashtags();
            // 4. Get hashtag count and top performer for return
            const hashtagCount = await TopHashtags_1.default.countDocuments({ platform: 'youtube' });
            const topPerformer = topVideos.length > 0 ? {
                title: topVideos[0].title,
                score: this.calculatePerformanceScore(topVideos[0]),
                views: topVideos[0].viewCount
            } : null;
            console.log('✅ YouTube Phase 2 scraping process completed successfully');
            return {
                videosScraped: topVideos.length,
                hashtagsUpdated: hashtagCount,
                topPerformer
            };
        }
        catch (error) {
            console.error('Error in YouTube full scrape process:', error);
            throw error;
        }
    }
}
exports.YouTubeScraper = YouTubeScraper;
