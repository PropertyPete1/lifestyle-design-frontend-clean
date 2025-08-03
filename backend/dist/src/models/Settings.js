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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const SettingsSchema = new mongoose_1.Schema({
    instagramToken: { type: String },
    instagramAccountId: { type: String },
    facebookPageId: { type: String },
    youtubeToken: { type: String },
    youtubeRefreshToken: { type: String },
    youtubeChannelId: { type: String },
    dropboxToken: { type: String },
    mongodbUri: { type: String },
    runwayApiKey: { type: String },
    openaiApiKey: { type: String },
    s3AccessKey: { type: String },
    s3SecretKey: { type: String },
    s3BucketName: { type: String },
    s3Region: { type: String },
    autopilotEnabled: { type: Boolean, default: false },
    manualEnabled: { type: Boolean, default: true },
    preferredPostTime: { type: String, default: '14:00' },
    peakHourTargeting: { type: Boolean, default: true },
    maxPostsPerDay: { type: Number, default: 5 },
    repostDelayDays: { type: Number, default: 7 },
    thumbnailMode: {
        type: String,
        enum: ['first', 'best', 'manual'],
        default: 'first'
    },
    captionEditorStyle: {
        type: String,
        enum: ['simple', 'advanced'],
        default: 'simple'
    },
    cartoonEnabled: { type: Boolean, default: false },
    platformDefaults: {
        postToInstagram: { type: Boolean, default: true },
        postToYouTube: { type: Boolean, default: true },
        crossPost: { type: Boolean, default: true }
    },
    dropboxFolder: { type: String, default: '/Bulk Upload' },
    fileRetentionDays: { type: Number, default: 30 },
    userId: { type: String, default: 'default' }
}, {
    timestamps: true
});
// Only keep one settings document per user
SettingsSchema.index({ userId: 1 }, { unique: true });
exports.default = mongoose_1.default.model('Settings', SettingsSchema);
