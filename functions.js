//    Core 
const Delay = (msec) => new Promise((resolve) => setTimeout(resolve, msec));
const FileIO = require("fs");
const SQL = require("./sql");
const Variables = require("./variables");
const Template = require("./template");

const Axios = require("axios");
const QS = require("qs");

const Compiler_Queue = [];
let Compiler_TimeLimit = false;

//    Functions
const Functions =
{
	Authentication_Configure: async function()
	{
		let check = async function()
		{
			await Functions.Compiler_Check();
			setTimeout(check, 1000 * 60 * 60) // 60 minutes
		}
		check();
		
		SQL.Connection.query("DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.device.admin')=JSON_EXTRACT('{}', '$');", 
		function(err)
		{
			if (err)
				console.error(err);
		});
	},
	Authentication_CheckUser: function(id)
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT * FROM authentication WHERE id='" + id + "'", 
			function (err, row) 
			{
				if (err)
					resolve(false);
				else if (row && row.length)
					resolve(true);
				else	
					resolve(false);
			});
		});
	},
	Authentication_ValidatePassword: function(id, password)
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT password FROM accounts WHERE id='" + id + "'", 
			function (err, row) 
			{
				if (row && row.length)
					resolve(row[0].password == password)
				else	
					resolve(false);
			});
		});
	},
	Authentication_GetUserDetails: function(id)
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT id, username, nickname, url FROM accounts WHERE id='" + id + "'", 
			function (err, row) 
			{
				if (row && row.length)
				{
					resolve({
						id: row[0].id,
						username: row[0].username,
						nickname: row[0].nickname,
						url: row[0].url
					});
				}
				else	
					resolve(null);
			});
		});
	},
	Authentication_Add: function(id, time, ip, role)
	{
		return new Promise((res) => 
		{
			SQL.Connection.query("SELECT * FROM authentication WHERE id='" + id + "'", function(err, row) 
			{
				if (row && row.length) 
				{
					SQL.Connection.query("UPDATE authentication SET ip='" + ip + "' WHERE id = '" + id + "'");
					SQL.Connection.query("UPDATE authentication SET time='" + time + "' WHERE id = '" + id + "'");
				} 
				else 
				{
					SQL.Connection.query("INSERT INTO authentication (id, time, ip, role) VALUES ('" + id + "', '" + time + "', '" + ip + "', '" + role + "')");
				}

				res();
			});
		})
	},
	Authentication_Remove: function(id)
	{
		SQL.Connection.query("DELETE FROM authentication WHERE id = '" + id + "'", 
		function (err, result) 
		{
			if (err)
				console.error(err);
		});
	},
	Administrator_GetOne: function(id)
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT id, username, nickname, url FROM accounts WHERE id=?",
			[id], 
			function (err, row) 
			{
				if (row && row.length)
				{
					resolve(
					{
						id: row[0].id,
						username: row[0].username,
						nickname: row[0].nickname,
						url: row[0].url
					});
				}
				else	
					resolve(
					{
						id: id,
						username: "unknown",
						nickname: "unknown",
						url: null
					});
			});
		});
	},
	Administrator_GetAll: function()
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT id, username, nickname, url FROM accounts", 
			function (err, row) 
			{
				if (row && row.length)
				{
					const accounts = [];
					for (let o of row)
					{
						accounts.push(
						{
							id: o.id,
							username: o.username,
							nickname: o.nickname,
							url: o.url
						})
					}
					resolve(accounts);
				}
				else	
					resolve([]);
			});
		});
	},
	Administrator_Log: async function(userid, type, from, to, reference)
	{
		let time = Date.now().toString();

		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("INSERT INTO auditlog (`user`, `from`, `to`, `reference`, `type`, `time`) VALUES (?, ?, ?, ?, ?, ?);",
			[userid, from, to, reference, type, time], 
			function(err)
			{
				if (err)
					console.error(err);
				
				resolve();
			})
		});
	},
	Administrator_GetAllLog: async function()
	{
		return new Promise(function(resolve, reject)
		{
			SQL.Connection.query("SELECT * FROM auditlog ORDER BY time DESC LIMIT 100", 
			async function(err, row)
			{
				if (err)
				{
					console.error(err);
					resolve([]);
				}
				else if (row && row.length)
				{
					let result = [];
					for (let i = 0; i < row.length; i++)
					{
						let log = "";
						let user = await Functions.Authentication_GetUserDetails(row[i].user);

						if (i > 0)
							if (
								row[i].user == row[i - 1].user && 
								row[i].type == row[i - 1].type && 
								row[i].reference == row[i - 1].reference &&
								row[i].from == row[i - 1].from &&
								row[i].to == row[i - 1].to &&
								row[i - 1].time - row[i].time < 1000 * 60 * 5
							)
								continue;

						if (row[i].type == "create")			log = "created a challenge '" + row[i].from + "'";
						else if (row[i].type == "update")		log = "updated a challenge '" + row[i].from + "'";
						else if (row[i].type == "rename")		log = "renamed a challenge from '" + row[i].from + "' to '" + row[i].to +"'";
						else if (row[i].type == "delete")		log = "deleted a challenge '" + row[i].from + "'";
						else if (row[i].type == "view")			log = "viewed a challenge '" + row[i].from + "'";
						else if (row[i].type == "signin")		log = "signed in";
						else if (row[i].type == "signout")		log = "signed out";
						else									log = row[i];

						result.push({ 
							time: row[i].time,
							text: log,
							user: 
							{ 
								nickname: user.nickname,
								username: user.username,
								id: user.id,
							},
							reference: row[i].reference
						});
					}

					resolve(result);
				}
				else
				{
					resolve([]);
				}
			});
		});
	},
	Server_Map: function (Server)
	{
		Server.post("/ping", (req, res) =>
		{
			res.send("OK");
		});
		
		Server.post("/admin/signin", (req, res) =>
		{
			SQL.Connection.query("SELECT id FROM accounts WHERE username='" + req.body.username + "'", 
			async function (err, row) 
			{
				if (err)
					res.status(500).send();
				else if (row && row.length)
				{
					let id = row[0].id;
					let time = Date.now();
					let ip = req.ip.split(":").pop();

					let valid = await Functions.Authentication_ValidatePassword(id, req.body.password);
					
					if (valid)
					{
						req.session.device.admin = id;
						await Functions.Authentication_Add(id, time, ip, "admin");
						Functions.Administrator_Log(req.session.device.admin, "signin");
						res.send("OK");
					}
					else
						res.status(401).send("FAIL: Incorrect username/password");
				}
				else	
					res.status(401).send();
			});
		});
		Server.get("/admin/signout", (req, res) => 
		{
			if (req.session.device != null)
			{
				Functions.Authentication_Remove(req.session.device.admin);
				Functions.Administrator_Log(req.session.device.admin, "signout");
				req.session.device.admin = {};
			}
			res.redirect("/admin/signin");
		})

		const fileEndsWith = (path, ends) => 
			{
				let value = false;
				value = ends.some(element => 
				{
					return path.endsWith(element);
				});
				return value;
			};

		Server.get("*", async (req, res) => 
			{
				let path = req.url;
				let source = Variables.WebRoot + "/main" + decodeURIComponent(path);
	
				// Remove the '/' prefix on the URL
				if (path.length > 1 && path.endsWith("/"))
				{
					res.redirect(path.substring(0, path.length - 1));
					return;
				}
	
				if (source.includes("?"))
					source = source.substring(0, source.indexOf("?"));
				
				const condition =
				{
					isLandingPage: (FileIO.existsSync(source) && !FileIO.lstatSync(source).isFile()) || !FileIO.existsSync(source),
					isPostOnly: source.includes("[p]"),
					isLocked: source.includes("[l]"),
					isHTML: source.endsWith(".html"),
					isImage: fileEndsWith(source, [".jpg", ".jpeg", ".png", ".bmp", ".webp"]) == true,
					isChallenge: source.includes("/code"),
					isAdmin: source.includes("/admin")
				}
				
				
				if (condition.isLandingPage)
				{
					if (source.endsWith("/"))
						source = source.substring(0, source.length - 1);
	
					const availability =
					{
						list:
						[
							{
								condition: FileIO.existsSync(source.replace(".html", "") + "/index.html"),
								replacement: source.replace(".html", "") + "/index.html"
							},
							{
								condition: FileIO.existsSync(source + "/index.html"),
								replacement: source + "/index.html"
							},
							{
								condition: FileIO.existsSync(source + ".html"),
								replacement: source + ".html"
							}
						],
						isAvailable: false	
					}
	
					for (statement of availability.list)
					{
						if (statement.condition == true)	
						{
							source = statement.replacement;
							availability.isAvailable = true;
							break;
						}
					}
					
					if (!availability.isAvailable) 
					{
						if (condition.isImage)
							res.status(404).sendFile(Variables.WebRoot + "/blank.png", { root: "./" });
						else
							res.status(404).sendFile(Variables.WebRoot + "/main/404.shtml", { root: "./" });
						
						return;
					}
					else if (condition.isAdmin)
					{
						if (!await Functions.Authentication_CheckUser(req.session.device.admin))
						//just send the file if the locked files are allowed on authenticated admin
						{
							if (!source.endsWith("/admin/signin.html"))
							{
								req.session.redirect = req.url;
								res.redirect("/admin/signin");
								return;
							}
						}
						else
						{
							//if user visits login page, redirect to attempted page or profile page.
							if (source.endsWith("signin.html"))
							{
								if (req.session.redirect != null)
									res.redirect(req.session.redirect);
								else
									res.redirect("/admin" + Variables.WebHomepage);
								
								req.session.redirect = null;
								return;
							}
						}
					}
				}
				
				if (condition.isPostOnly || condition.isLocked)
				{
					res.status(403).sendFile(Variables.WebRoot + "/main/403.shtml", { root: "./" });
					return;
				}
				else if (source.endsWith(".html")) 
				{
					FileIO.readFile(source, async (err, data) => 
					{
						if (err) 
						{
							res.status(500).send("FAIL: " + err);
							return;
						}
						const activeUser = await Functions.Authentication_GetUserDetails(req.session.device.admin) || { username: null, nickname: null};
						const challenge = condition.isChallenge ? await Functions.Challenge_Details(req.query.id) : {};

						let templatedData =
							"<!DOCTYPE html>" +
							"<html " + Template.Data.Configuration + ">" +
							"<head>" +
							(condition.isAdmin ? Template.Data.Head_Admin : Template.Data.Head) +
							"</head>" +
							"<body>" +
							Template.Data.Script +
							(condition.isChallenge ? "<ad-desc>" + challenge.snippet + "</ad-desc>" : "") +
							(condition.isChallenge ? "<ad-name>" + challenge.name + " by " + (await Functions.Administrator_GetOne(challenge.author)).nickname + "</ad-name>" : "") +
							(condition.isAdmin ? Template.Data.Body_Admin : Template.Data.Body) +
							Template.Data.Script_Main +
							"</body>" +
							"</html>";
							
						templatedData = 
							templatedData
								.replace("<#? content ?#>", data)
								.replace("<#? navigation ?#>", (condition.isAdmin ? Template.Data.Navigation_Admin : Template.Data.Navigation))
								.replaceAll("<#? apptitle ?#>", Variables.AppTitle)
								.replaceAll("<#? appicon ?#>", Variables.AppIcon)
								.replaceAll("<#? appassets ?#>", Variables.AppAssets)
								.replaceAll("<#? apphomepage ?#>", Variables.WebHomepage)
								.replaceAll("<#? appversion ?#>", Variables.Version)
								.replaceAll("<#? activeuser.id ?#>", activeUser.id)
								.replaceAll("<#? activeuser.username ?#>", activeUser.username)
								.replaceAll("<#? activeuser.nickname ?#>", activeUser.nickname)
								.replaceAll("<#? compiler.status_code ?#>", Functions.Compiler_Status.code)
								.replaceAll("<#? compiler.status_lastupdated ?#>", Functions.Compiler_Status.lastUpdated)
								.replaceAll("<#? compiler.status_servertime ?#>", Date.now());
						
						templatedData = Functions.Data_Compile(req, templatedData);
						res.send(templatedData);
					});
				}
				else
				{
					res.sendFile(source, { root: "./" });
				}
			})
	},

	Server_Ping: async function ()
	{
		await Axios.post(Variables.WebPing);
	},

	Server_Start: function (Server)
	{
		Server.listen(17194, () =>  
		{
			if (Variables.Production)
			{
				console.log("Server is ready");
			}
			else
			{
				console.log("Server for development is ready");
				console.error("This server is running under development mode. Please switch to production as soon as possible since it's vulnerable.");
			}
		});
	},

	Data_Compile: function (req, Data)
	{
		language_prefix = Data.match(/<\$(.*?)\/>/g);
		if (language_prefix != null) {
			for (let prefix of language_prefix)
			{
				let lang = req.session.language;
				let page = prefix.substring(2, prefix.length - 2).split(" ")[1];
				let param = prefix.substring(2, prefix.length - 2).split(" ")[2];
				let replacement = prefix;

				if (Language.Data[lang][page] != null && Language.Data[lang][page][param] != null)
				{
					replacement = Language.Data[lang][page][param];
				}
				Data = Data.replaceAll(prefix, replacement);
			}
		}

		pageVariables = [
			{ prefix: "ad-title", replacement: "page_title" },
			{ prefix: "ad-name", replacement: "page_name" },
			{ prefix: "ad-desc", replacement: "page_description" },
			{ prefix: "ad-keyword", replacement: "page_keywords", default: Variables.Keyword },
			{ prefix: "ad-thumbnail", replacement: "page_thumbnail", default: Variables.Thumbnail }
		];
		for (variable of pageVariables)
		{
			variable.default = variable.default == null ? "" : variable.default;
			let pattern = new RegExp("<" + variable.prefix + ">(.*?)<\/" + variable.prefix + ">", "gs");
			let result = pattern.exec(Data);
			let elements = Data.match(pattern);

			if (result != null && result[1].trim() != "")
			{
				Data = Data.replaceAll("<#? " + variable.replacement + " ?#>", result[1].replaceAll("\n", " "))
				for (let element of elements)
				{
					Data = Data.replaceAll(element, "");
				}
			}
			else
				Data = Data.replaceAll("<#? " + variable.replacement + " ?#>", variable.default)
		}

		return Data;
	},
	Code_Compile: async function (code, input, language, requestOccurence = 1, timeLimitOccurence = 1)
	{
		const languages = [
			{
				language: ["java"],
				version: "15.0.2"
			},
			{
				language: ["javascript", "js"],
				version: "1.32.3"
			},
			{
				language: ["csharp", "c#", "cs"],
				version: "5.0.201"
			},
			{
				language: ["cpp", "c++"],
				version: "10.2.0"
			},
			{
				language: ["python", "py"],
				version: "3.10.0"
			}
		];

		if (!language)
			return { error: "Please specify language" };

		const languageDetails = languages.find(o => o.language.includes(language));

		if (languageDetails == null)
			return { error: "Language for " + language + " are not supported yet." };

		if (requestOccurence >= 15)
			return { error: "Compiler is busy, try again later" };

		const now = Date.now();
		let scheduledTime = now;

		if (Compiler_Queue.length > 0) 
		{
			const last = Compiler_Queue[Compiler_Queue.length - 1];
			scheduledTime = Math.max(last + 1000, now);
		}

		Compiler_Queue.push(scheduledTime);

		return new Promise(async function(resolve, reject)
		{
			await Delay(scheduledTime - now);

			if (Compiler_TimeLimit == true)
			{
				Compiler_TimeLimit = false;
				await Delay(1000);
			}

			var data = QS.stringify({
				files: 
				[
					{
						content: code
					}
				],
				stdin: input,
				language: languageDetails.language[0],
				version: languageDetails.version
			});
			
			const config = 
			{
				method: "POST",
				url: "https://emkc.org/api/v2/piston/execute",
				headers: 
				{
					"Content-Type": "application/x-www-form-urlencoded"
				},
				data : data
			};
	
			Axios(config)
			.then(async function (response) 
			{
				const data = response.data.run;

				if (data.stderr.trim() != "")
					resolve({
						error: data.stderr
					});
				else if (data.signal == "SIGKILL")
				{
					if (timeLimitOccurence >= 5)
					{
						resolve({
							error: "Time limit exception"
						});
					}
					else
					{
						// tell the queue to cooldown the request
						Compiler_TimeLimit = true;
						resolve(await Functions.Code_Compile(code, input, language, 1, timeLimitOccurence + 1));
					}
				}
				else
					resolve({
						output: data.stdout
					});
			})
			.catch(async function (error) 
			{
				let err = "COMPILER UNAVAILABLE";

				if (error && error.response && error.response.status == 429)
				{
					resolve(await Functions.Code_Compile(code, input, language, requestOccurence + 1));
					return;
				}
				else if (error && error.response && error.response.status >= 500 && error.response.status <= 599)
				{
					err;
				}
				else
				{
					console.error("Compiler exception:", error.message);
					if (error && error.response)
						console.error(error.response.data.message);
				}

				resolve({
					error: err
				});
			});
		});
	},

	Challenge_Details: function(id, full = false)
	{
		let types = full ? "*" : "author, name, snippet";

		return new Promise((res, rej) => 
		{
			SQL.Connection.query("SELECT " + types + " FROM challenges WHERE id='" + id + "'", function(err, row) 
			{
				if (err)
					res({
						name: "Challenge",
						author: "",
						snippet: ""
					});
				else if (row && row.length)
					res(row[0]);
				else
					res({
						name: "Challenge",
						author: "",
						snippet: ""
					});
			});
		})
	},

	Compiler_Status: { code: null, lastUpdated: null },
	Compiler_Check: async function()
	{
		Functions.Server_Ping().catch(o => 
		{ 
			console.error("Server shut down"); 
			process.exit(); 
		});
		Functions.Compiler_Status.code = "checking";
		Functions.Compiler_Status.lastUpdated = Date.now();

		return new Promise(async res => 
		{	
			let timeoutPromise = new Promise(async res => 
			{
				setTimeout(o =>
				{
					res(false);
				}, 10000);
			})
	
			let compilerPromise = new Promise(async res => 
			{
				let up = false;
				try
				{
					let a = await Functions.Code_Compile("public class ftis{public static void main(String args[]){System.out.println(\"OK\");}}", "", "java");
					up = a.output ? true : false;
				}
				catch { }
	
				res(up);
			});
	
			let result = await Promise.race([timeoutPromise, compilerPromise]);	
			Functions.Compiler_Status.code = result ? "up" : "down";
			Functions.Compiler_Status.lastUpdated = Date.now();
	
			res();
		})
	},

	Array_Remove: function (Array)
	{
		var what, a = arguments, L = a.length, ax;
		while (L && Array.length) { what = a[--L]; while ((ax = Array.indexOf(what)) !== -1) { Array.splice(ax, 1); } }
		return Array;
	}
}

module.exports = Functions;