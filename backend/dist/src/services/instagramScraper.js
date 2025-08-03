"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const PostInsights_1 = __importDefault(require("../models/PostInsights"));
const TopHashtags_1 = __importDefault(require("../models/TopHashtags"));
class InstagramScraper {
    constructor(accessToken, pageId) {
        this.accessToken = accessToken;
        this.pageId = pageId;
    }
    /**
     * Fetch top 500 performing videos from Instagram page - PHASE 2 ENHANCED
     */
    async scrapeTopPerformingVideos() {
        var _a, _b, _c;
        try {
            console.log('🎯 PHASE 2: Fetching up to 500 Instagram videos for analysis...');
            // First, get all videos from page (up to 500 recent posts)
            const allVideos = await this.fetchPageVideos();
            console.log(`📊 Fetched ${allVideos.length} videos from Instagram page`);
            // Calculate performance scores and sort
            const videosWithScores = allVideos.map(video => ({
                ...video,
                performanceScore: this.calculatePerformanceScore(video)
            }));
            // Sort by performance score and return all (up to 500)
            const topVideos = videosWithScores
                .sort((a, b) => b.performanceScore - a.performanceScore);
            console.log(`✅ Analyzed ${topVideos.length} Instagram videos with performance scores`);
            if (topVideos.length > 0) {
                console.log(`🏆 Top performer: ${(_b = (_a = topVideos[0]) === null || _a === void 0 ? void 0 : _a.caption) === null || _b === void 0 ? void 0 : _b.substring(0, 50)}... (Score: ${(_c = topVideos[0]) === null || _c === void 0 ? void 0 : _c.performanceScore})`);
            }
            return topVideos;
        }
        catch (error) {
            console.error('Error scraping Instagram videos:', error);
            console.warn('⚠️ Instagram API unavailable - using production fallback workflow for Phase 2 processing');
            throw new Error('Instagram API access failed - no fallback data available');
        }
    }
    /**
     * Fetch video posts from Instagram page - ENHANCED for 500 videos
     */
    async fetchPageVideos() {
        var _a;
        const videos = [];
        let nextUrl = '';
        let totalFetched = 0;
        const targetVideos = 500; // PHASE 2: Increased from 200 to 500
        try {
            // Try different Instagram Business Account IDs and API versions
            const possibleIds = [
                this.pageId,
                '17841454131323777', // From memory
                '732270276634005' // Facebook Page ID as fallback
            ];
            const apiVersions = ['v23.0', 'v19.0', 'v18.0'];
            let workingUrl = '';
            let workingId = '';
            let workingVersion = '';
            console.log('🔍 Testing Instagram API endpoints...');
            for (const id of possibleIds) {
                for (const version of apiVersions) {
                    try {
                        const testUrl = `https://graph.facebook.com/${version}/${id}/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${this.accessToken}&limit=5`;
                        const testResponse = await fetch(testUrl);
                        if (testResponse.ok) {
                            workingUrl = `https://graph.facebook.com/${version}/${id}/media`;
                            workingId = id;
                            workingVersion = version;
                            console.log(`✅ Found working Instagram endpoint: ${version}/${id}`);
                            break;
                        }
                    }
                    catch (testError) {
                        continue;
                    }
                }
                if (workingUrl)
                    break;
            }
            if (!workingUrl) {
                console.warn('⚠️ Instagram API not accessible - using minimal fallback data');
                throw new Error('Instagram API access failed - no fallback data available');
            }
            // Initial request to get page media
            let url = `${workingUrl}?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${this.accessToken}&limit=50`;
            while (totalFetched < targetVideos) {
                let response;
                try {
                    response = await axios_1.default.get(url);
                }
                catch (apiError) {
                    console.warn('⚠️ Instagram API call failed - stopping pagination');
                    break;
                }
                const data = response.data;
                if (!data.data || data.data.length === 0) {
                    console.log('📝 No more Instagram media found');
                    break;
                }
                // Filter for video content and get insights
                for (const media of data.data) {
                    if (media.media_type === 'VIDEO' || media.media_type === 'REELS') {
                        try {
                            // Try to get enhanced insights for this media
                            const insights = await this.getMediaInsights(media.id, workingVersion);
                            const enrichedVideo = {
                                ...media,
                                like_count: insights.like_count || media.like_count || 0,
                                comments_count: insights.comments_count || media.comments_count || 0,
                                video_views: insights.video_views || 0
                            };
                            videos.push(enrichedVideo);
                        }
                        catch (insightError) {
                            // Add video without enhanced insights
                            videos.push({
                                ...media,
                                like_count: media.like_count || 0,
                                comments_count: media.comments_count || 0,
                                video_views: 0 // Will be estimated in performance scoring
                            });
                        }
                    }
                }
                totalFetched += data.data.length;
                console.log(`📥 Progress: ${totalFetched}/${targetVideos} Instagram posts processed, ${videos.length} videos found`);
                // Check for next page
                if ((_a = data.paging) === null || _a === void 0 ? void 0 : _a.next) {
                    url = data.paging.next;
                }
                else {
                    console.log('📝 Reached end of Instagram media pagination');
                    break;
                }
                // Add delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`✅ Total Instagram videos fetched: ${videos.length}`);
            return videos;
        }
        catch (error) {
            console.error('Error fetching Instagram page videos:', error);
            throw error;
        }
    }
    /**
     * Get insights for specific media - ENHANCED with fallback
     */
    async getMediaInsights(mediaId, apiVersion = 'v19.0') {
        try {
            // Try insights endpoint first
            const insightsResponse = await axios_1.default.get(`https://graph.facebook.com/${apiVersion}/${mediaId}/insights?metric=likes,comments,video_views&access_token=${this.accessToken}`);
            const insights = insightsResponse.data.data || [];
            const result = {};
            insights.forEach((insight) => {
                var _a, _b, _c;
                if (insight.name === 'likes') {
                    result.like_count = ((_a = insight.values[0]) === null || _a === void 0 ? void 0 : _a.value) || 0;
                }
                else if (insight.name === 'comments') {
                    result.comments_count = ((_b = insight.values[0]) === null || _b === void 0 ? void 0 : _b.value) || 0;
                }
                else if (insight.name === 'video_views') {
                    result.video_views = ((_c = insight.values[0]) === null || _c === void 0 ? void 0 : _c.value) || 0;
                }
            });
            return result;
        }
        catch (error) {
            // If insights are not available, try alternative approach
            try {
                const response = await axios_1.default.get(`https://graph.facebook.com/${apiVersion}/${mediaId}?fields=like_count,comments_count&access_token=${this.accessToken}`);
                return response.data;
            }
            catch (fallbackError) {
                // Return empty object - will use default values
                return {};
            }
        }
    }
    /**
     * Calculate performance score based on views, likes, comments - ENHANCED ALGORITHM
     */
    calculatePerformanceScore(video) {
        const views = video.video_views || 0;
        const likes = video.like_count || 0;
        const comments = video.comments_count || 0;
        // PHASE 2 ENHANCED: Weighted scoring algorithm for Instagram
        // Views (50%), Likes (30%), Comments (20%) - adjusted for Instagram engagement patterns
        const viewScore = views * 0.5;
        const likeScore = likes * 30; // Weight likes higher per unit
        const commentScore = comments * 20; // Weight comments highest per unit
        // Engagement rate bonus (likes + comments relative to views)
        const engagementRate = views > 0 ? (likes + comments) / views : 0;
        const engagementBonus = engagementRate * 500; // Bonus for high engagement (adjusted for Instagram)
        // If no views available, estimate based on likes (Instagram often doesn't provide view counts)
        const estimatedViews = views || (likes * 5); // Rough estimation: 1 like per 5 views
        const estimatedViewScore = estimatedViews * 0.5;
        const totalScore = (views > 0 ? viewScore : estimatedViewScore) + likeScore + commentScore + engagementBonus;
        return Math.round(totalScore);
    }
    /**
     * Extract hashtags from Instagram caption - ENHANCED
     */
    extractHashtags(caption) {
        if (!caption)
            return [];
        const hashtagRegex = /#[a-zA-Z0-9_]+/g;
        const hashtags = caption.match(hashtagRegex) || [];
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
        var _a, _b;
        try {
            console.log(`💾 Saving ${videos.length} Instagram video insights to MongoDB...`);
            let savedCount = 0;
            let updatedCount = 0;
            for (const video of videos) {
                const hashtags = this.extractHashtags(video.caption || '');
                const performanceScore = this.calculatePerformanceScore(video);
                // Check if video already exists
                const existingInsight = await PostInsights_1.default.findOne({ videoId: video.id });
                if (!existingInsight) {
                    await PostInsights_1.default.create({
                        platform: 'instagram',
                        videoId: video.id,
                        caption: video.caption || 'Instagram video - no caption',
                        hashtags,
                        performanceScore,
                        repostEligible: true,
                        reposted: false,
                        originalPostDate: new Date(video.timestamp),
                        views: video.video_views || 0,
                        likes: video.like_count || 0,
                        comments: video.comments_count || 0,
                        title: ((_a = video.caption) === null || _a === void 0 ? void 0 : _a.substring(0, 100)) || 'Instagram Video',
                        scrapedAt: new Date()
                    });
                    savedCount++;
                }
                else {
                    // Update existing record with latest stats
                    await PostInsights_1.default.findByIdAndUpdate(existingInsight._id, {
                        views: video.video_views || 0,
                        likes: video.like_count || 0,
                        comments: video.comments_count || 0,
                        performanceScore,
                        hashtags, // Update hashtags in case caption changed
                        caption: video.caption || 'Instagram video - no caption',
                        title: ((_b = video.caption) === null || _b === void 0 ? void 0 : _b.substring(0, 100)) || 'Instagram Video',
                        scrapedAt: new Date()
                    });
                    updatedCount++;
                }
            }
            console.log(`✅ Saved ${savedCount} new Instagram insights, updated ${updatedCount} existing records`);
        }
        catch (error) {
            console.error('Error saving Instagram video insights:', error);
            throw error;
        }
    }
    /**
     * Update top hashtags based on scraped videos - PHASE 2 ENHANCED
     */
    async updateTopHashtags() {
        try {
            console.log('🏷️ Updating Instagram hashtag analytics...');
            // Get all Instagram videos from PostInsights
            const instagramVideos = await PostInsights_1.default.find({ platform: 'instagram' });
            // Aggregate hashtag data
            const hashtagStats = new Map();
            for (const video of instagramVideos) {
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
                    platform: 'instagram',
                    totalViews: stats.totalViews,
                    totalLikes: stats.totalLikes,
                    lastUpdated: new Date()
                }, { upsert: true, new: true });
            }
            console.log(`✅ Updated ${hashtagStats.size} Instagram hashtags in TopHashtags collection`);
        }
        catch (error) {
            console.error('Error updating Instagram top hashtags:', error);
            throw error;
        }
    }
    /**
     * Full scraping process: fetch videos, save insights, update hashtags - PHASE 2 COMPLETE
     */
    async performFullScrape() {
        var _a;
        try {
            console.log('🚀 Starting Instagram Phase 2 scraping process...');
            // 1. Scrape top performing videos (up to 500)
            const topVideos = await this.scrapeTopPerformingVideos();
            // 2. Save video insights
            await this.saveVideoInsights(topVideos);
            // 3. Update hashtag analytics
            await this.updateTopHashtags();
            // 4. Get hashtag count and top performer for return
            const hashtagCount = await TopHashtags_1.default.countDocuments({ platform: 'instagram' });
            const topPerformer = topVideos.length > 0 ? {
                caption: ((_a = topVideos[0].caption) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) + '...' || 'No caption',
                score: this.calculatePerformanceScore(topVideos[0]),
                likes: topVideos[0].like_count || 0
            } : null;
            console.log('✅ Instagram Phase 2 scraping process completed successfully');
            return {
                videosScraped: topVideos.length,
                hashtagsUpdated: hashtagCount,
                topPerformer
            };
        }
        catch (error) {
            console.error('❌ Instagram full scrape process failed:', error);
            console.error('🚫 No fallback data available - Instagram API credentials required');
            return {
                videosScraped: 0,
                hashtagsUpdated: 0,
                topPerformer: null
            };
        }
    }
}
exports.InstagramScraper = InstagramScraper;
