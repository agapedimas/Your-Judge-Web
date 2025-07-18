const Variables = 
{
	WebRoot: "./web",
	WebHomepage: "/",
	AppTitle: "Your Judge",
	Version: "1.4.0",

	AdminUsername: [],
	ActiveUser: [],

    Production: (process.env.NODE_ENV == "production")
}

Variables.WebPing = Variables.Production ? "https://judge.agapedimas.com/ping" : "http://localhost:17194/ping";
Variables.AppAssets = Variables.Production ? "https://assets.agapedimas.com" : "http://localhost:1202";
Variables.AppIcon = "/icon_logo.ico";

module.exports = Variables;