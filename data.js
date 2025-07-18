//    Core 
const SQL = require("./sql");
const Variables = require("./variables");
const Functions = require("./functions");
const Template = require("./template");
const fs = require("fs");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

//    Functions
function Data(Server) 
{  
    Server.post("/compile/*", async (req, res) =>
    {
        const language = req.path.split("/")[2];
        const result = await Functions.Code_Compile(req.body.code, req.body.input, language);
        res.send(result);
    });
    
    Server.post("/challenges/get", async (req, res) =>
    {
        let query = `
            SELECT c.id, c.name, c.topic, c.snippet, c.time, c.cases,
            JSON_OBJECT('id', a.id, 'username', a.username, 'nickname', a.nickname) AS author
            FROM challenges AS c
            INNER JOIN accounts AS a ON c.author = a.id
        `;

        let args = [];

        if (req.body.query)
        {    
            query += "WHERE UPPER(c.name) LIKE UPPER(?) ";
            query += "OR UPPER(c.topic) LIKE UPPER(?) ";
            query += "OR UPPER(c.snippet) LIKE UPPER(?) ";
            query += "OR UPPER(a.nickname) LIKE UPPER(?) ";
            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");

            query += 
                "ORDER BY CASE " +
                    "WHEN UPPER(c.topic) LIKE UPPER(?) THEN 1 " + 
                    "WHEN UPPER(c.name) LIKE UPPER(?) THEN 2 " +
                    "WHEN UPPER(c.snippet) LIKE (?) THEN 3 " +
                    "WHEN UPPER(a.nickname) LIKE (?) THEN 4 " +
                    "ELSE 4 " +
                "END, time DESC;";

            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");
            args.push("%" + req.body.query + "%");
        }
        else
        {
            query += "ORDER BY time DESC;";
        }

        let result = await SQL.Query(query, args);
        
        if (result.data)
            result.data = result.data.map(o => 
            {
                o.author = JSON.parse(o.author);
                return o;
            });

        if (result.success)
            res.send(result.data);
        else
            res.status(500).send();
    });

    Server.post("/challenges/get/*", async (req, res) =>
    {
        let query = "SELECT c.id, c.name, c.topic, c.problem, c.time, c.cases,";

        // if administrator, then fetch the entire columns
        if (await Functions.Authentication_CheckUser(req.session.device.admin))
            query += "c.inputs, c.outputs, ";
        
        query += `
            JSON_OBJECT('id', a.id, 'username', a.username, 'nickname', a.nickname) AS author
            FROM challenges AS c
            INNER JOIN accounts AS a ON c.author = a.id
            WHERE c.id=?
        `;
        
        const result = await SQL.Query(query, [req.url.split("/").pop()]);
        const data = result.data?.at(0);

        if (data?.author)
            data.author = JSON.parse(data.author);
        
        if (result.success)
            res.status(data ? 200 : 404).send(data);
        else
            res.status(500).send();
    });

    Server.get("/challenges/*", async (req, res, next) =>
    {
        const paths = req.url.split("/").filter(o => o != "");

        if (paths.length == 2 && isNaN(paths[1]) == false)
            res.redirect("/challenges/code?id=" + paths[1]);
        else
            next();
    });

    Server.get("/admin/challenges/*", async (req, res, next) =>
    {
        const paths = req.url.split("/").filter(o => o != "");

        if (req.url.startsWith("/admin/challenges/edit"))
        {
            let id = paths[2].replace("edit?id=", "");
            let challenge = await Functions.Challenge_Details(id, true);
            
            if (challenge.id)
                Functions.Administrator_Log(req.session.device.admin, "view", challenge.name, null, id);
        }

        if (paths.length == 3 && isNaN(paths[2]) == false)
            res.redirect("/admin/challenges/edit?id=" + paths[2]);
        else
            next();
    });

    Server.get("/admin/auditlog/get", async (req, res) => 
    {
        let logs = await Functions.Administrator_GetAllLog();
        res.send(logs);
    });

    Server.get("/challenges/test/*", (req, res) =>
    {
        SQL.Connection.query("SELECT inputs, outputs FROM challenges WHERE id='" + req.path.split("/").pop() + "'", async function(err, row) 
        {   
            if (err)
            {
                res.status(500).send();
                console.error(err);
            }
            else if (row && row.length)
            {
                res.writeHead(200, 
                {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                
                let inputs = row[0].inputs.split(";").filter(Boolean).map(o => o.trim());
                let outputs = row[0].outputs.split(";").filter(Boolean).map(o => o.trim());
                
                for (let i = 0; i < inputs.length; i++)
                {
                    let result = await Functions.Code_Compile(req.query.code, inputs[i], req.query.language);
                    
                    res.write("event: message\n");
                    if (result.error || !outputs[i] || !result.output)
                    {
                        res.write("data: " + JSON.stringify({number: i + 1, status: "ERROR", error: result.error}) + "\n\n");
                    }
                    else
                    {
                        let output1 = [];
                        let output2 = [];

                        for (let o of result.output.split("\n"))
                            output1.push(o.trim());
                        result.output = output1.join("\n");
                        
                        for (let o of outputs[i].split("\n"))
                            output2.push(o.trim());
                        outputs[i] = output2.join("\n");

                        if (result.output.trim() == outputs[i])
                            res.write("data: " + JSON.stringify({number: i + 1, status: "OK"}) + "\n\n");
                        else
                            res.write("data: " + JSON.stringify({number: i + 1, status: "WRONG"}) + "\n\n");
                    }
                }

                res.write("event: message\n");
                res.write("data: DONE\n\n");
                res.end();
            }
            else
                res.status(404).send("FAIL: Not Found");
        });
    });

    Server.post("/challenges/create", async (req, res) =>
    {
        if (await Functions.Authentication_CheckUser(req.session.device.admin))
        {
            let id = Date.now().toString(), 
                time = Date.now().toString(), 
                author = req.session.device.admin,
                name = req.body.name, 
                topic = req.body.topic, 
                problem = "", 
                snippet = "", 
                inputs = "", 
                outputs = "",
                cases = "0";
    
            SQL.Connection.query(
                "INSERT INTO challenges" + 
                "(id, time, author, name, topic, problem, snippet, inputs, outputs, cases) VALUES " +
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id, time, author, name, topic, problem, snippet, inputs, outputs, cases],
            function(err)
            {
                if (err)
                {
                    res.status(500).send();
                    console.error(err);
                }
                else
                    res.send(id);
            });

            Functions.Administrator_Log(req.session.device.admin, "create", name, null, id);
        }
        else
        {
            res.status(403).send("FAIL: No permission to access");
        }
    });
    
    Server.post("/challenges/update", async (req, res) =>
    {
        let challenge = await Functions.Challenge_Details(req.body.id, true);

        if (await Functions.Authentication_CheckUser(req.session.device.admin))
        {
            let id = req.body.id, 
                name = req.body.name.trim(), 
                topic = req.body.topic.trim(),
                problem = req.body.problem.trim(), 
                inputs = req.body.inputs.trim(), 
                outputs = req.body.outputs.trim(),
                snippet = "",
                cases = inputs.split(";").filter(Boolean).length;

            if (problem != "")
            {
                const dom = new JSDOM("<!DOCTYPE html><div id='main'>" + problem.replace(/\>\</g, ">&nbsp;<") + "</div>");
                snippet = dom.window.document.querySelector("#main").textContent.replace(/\xa0/g, "\n");
                snippet = snippet.replace(/\n\n/g, "\n");
                
                if (snippet.toLowerCase().indexOf("spesifikasi masukan") > -1)
                    snippet = snippet.substring(0, snippet.toLowerCase().indexOf("spesifikasi masukan"));
                else if (snippet.toLowerCase().indexOf("spesifikasi input") > -1)
                    snippet = snippet.substring(0, snippet.toLowerCase().indexOf("spesifikasi input"));

                snippet = snippet.trim();

                if (snippet.length > 800)
                    snippet = snippet.substring(0, 800);
            }

            SQL.Connection.query(
                "UPDATE challenges SET name=?, topic=?, problem=?, snippet=?, inputs=?, outputs=?, cases=? WHERE id = ?",
            [name, topic, problem, snippet, inputs, outputs, cases, id],
            async function (err, result)
            {
                if (err)
                {
                    res.status(500).send();
                    console.error(err);
                }
                else 
                {
                    if (name != "" && name != challenge.name)
                        Functions.Administrator_Log(req.session.device.admin, "rename", challenge.name, name, id);
                    
                    if (
                        (problem != "" && problem != challenge.problem) ||
                        (topic != "" && topic != challenge.topic) ||
                        (inputs != "" && inputs != challenge.inputs) ||
                        (outputs != "" && outputs != challenge.outputs)
                    )
                        Functions.Administrator_Log(req.session.device.admin, "update", name || challenge.name, null, id);
                    
                    res.send("OK");
                }
            });
        }
        else
        {
            res.status(403).send("FAIL: No permission to access");
        }
    });

    Server.post("/challenges/delete", async (req, res) =>
    {
        let challenge = await Functions.Challenge_Details(req.body.id, true);
        if (await Functions.Authentication_CheckUser(req.session.device.admin))
        {
            let id = req.body.id;
            
            SQL.Connection.query("DELETE FROM challenges WHERE id = ?",
            [id],
            function(err)
            {
                if (err)
                {
                    res.status(500).send();
                    console.error(err);
                }
                else
                {
                    res.send("OK");
                    Functions.Administrator_Log(req.session.device.admin, "delete", challenge.name, null, null);
                }
            });
        }
        else
        {
            res.status(403).send("FAIL: No permission to access");
        }
    });

    Server.post("/authors/get", async (req, res) => 
    {
        let authors = await Functions.Administrator_GetAll();
        res.send(authors);
    });

    Server.get("/avatar/*", async (req, res) =>
    {
        const id = req.path.split("/")[2];

        if (fs.existsSync(Variables.WebRoot + "/main/avatar/" + id + ".webp"))
            res.sendFile(Variables.WebRoot + "/main/avatar/" + id + ".webp", { root: "./" });
        else
            res.status(404).sendFile(Variables.WebRoot + "/main/avatar/default.webp", { root: "./" });
    });
}

module.exports = Data;