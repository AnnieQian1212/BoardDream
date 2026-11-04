// The promo is laid out at 1920 x 1080 and 60 fps. The 2K master renders at --scale=4/3
// (2560 x 1440, every frame a PNG so small type stays sharp); the preview at --scale=2/3 (720p).
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
Config.setDefaultPremountInSeconds(1);
