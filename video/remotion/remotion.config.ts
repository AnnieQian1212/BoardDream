/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// The film: laid out at 1920 x 1080, rendered at 2560 x 1440 (2K) and 60 fps, every frame a PNG so
// small type stays sharp, at the bitrate YouTube asks for 1440p60.
Config.setVideoImageFormat("png");
Config.setScale(4 / 3);
Config.setVideoBitrate("24M");
Config.setX264Preset("slow");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// The light leaks between scenes are drawn with WebGL.
Config.setChromiumOpenGlRenderer("angle");
