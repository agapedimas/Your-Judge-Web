const MySQL = require("mysql");
const Delay = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

const SQL = 
{
    Configuration: 
    {
        connectionLimit: 10,
        host: "localhost",
        port: 3306,
        user: process.env.SQL_USERNAME,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DATABASE,
        charset: "utf8mb4",
        createDatabaseTable: true
    },
    /** @type { MySQL.Connection } */
    Connection: undefined,
    /**  
     * @param { string } query
     * @param { Array<string> } values 
     * @returns { Promise<{
     *      success: boolean,
     *      data: Array<object>
     * }> }
     */
    Query: function(query, values = []) 
    {
        return new Promise(function(resolve)
        {
            SQL.Connection.query(query, values, function(error, results)
            {
                if (error)
                {
                    console.error(error);
                    resolve({ success: false, data: null });
                }

                if (results && results.length)
                    resolve({ success: true, data: results });
                else
                    resolve({ success: true, data: null });
            })
        });
    },
    /** @returns { Promise<void> } */
    Initialize: function(occurence = 1)
    {
        return new Promise(function(resolve)
        {
            SQL.Connection = MySQL.createConnection(SQL.Configuration);
            SQL.Connection.on("error", async function(err) 
            {
                if (err.code === "PROTOCOL_CONNECTION_LOST")
                    await SQL.Initialize();
                else if (err.code === "ETIMEDOUT")
                    await SQL.Initialize();
                else if (err.code === "UND_ERR_CONNECT_TIMEOUT")
                    await SQL.Initialize();
                else 
                    throw err;
            });
            SQL.Connection.connect(async function(err)
            {
                if (err) 
                {
                    if (err.code == "ECONNREFUSED" && occurence < 60)
                    {
                        await Delay(1000);
                        return resolve(await SQL.Initialize(occurence + 1));
                    }
                    else
                    {
                        console.error("Error when connecting to database:\n", err);
                        return process.exit();
                    }
                }

                const query_accounts = 
                    "CREATE TABLE IF NOT EXISTS `accounts` " + 
                        "(" +
                            "`id` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`username` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`nickname` text COLLATE utf8mb4_bin NOT NULL, " +
                            "`url` varchar(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`password` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                                "PRIMARY KEY (`id`), " +
                                "UNIQUE KEY `username` (`username`)" +
                        ") " +
                    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;";

                await SQL.Query(query_accounts);

                const query_challenges = 
                    "CREATE TABLE IF NOT EXISTS `challenges` " +
                        "(" +
                            "`id` varchar(128) CHARACTER SET ascii NOT NULL, " +
                            "`time` varchar(25) CHARACTER SET ascii NOT NULL, " +
                            "`author` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`name` tinytext COLLATE utf8mb4_bin NOT NULL, " +
                            "`topic` text COLLATE utf8mb4_bin, " +
                            "`problem` mediumtext COLLATE utf8mb4_bin NOT NULL, " +
                            "`snippet` varchar(1000) COLLATE utf8mb4_bin NOT NULL, " +
                            "`inputs` mediumtext COLLATE utf8mb4_bin NOT NULL, " +
                            "`outputs` mediumtext COLLATE utf8mb4_bin NOT NULL, " +
                            "`cases` int(11) NOT NULL, " +
                                "PRIMARY KEY (`id`), " +
                                "CONSTRAINT `fk_challenges_author` " +
                                    "FOREIGN KEY (`author`) REFERENCES `accounts`(`id`) " +
                                    "ON UPDATE CASCADE" +
                        ") " + 
                    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;";

                await SQL.Query(query_challenges);

                const query_auditlog = 
                    "CREATE TABLE IF NOT EXISTS `auditlog` " +
                        "(" +
                            "`id` int(11) NOT NULL AUTO_INCREMENT, " +
                            "`user` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`from` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin, " +
                            "`to` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin, " +
                            "`reference` varchar(128) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL, " +
                            "`type` varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`time` varchar(25) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                                "PRIMARY KEY (`id`), " +
                                "CONSTRAINT `fk_auditlog_user` " +
                                    "FOREIGN KEY (`user`) REFERENCES `accounts`(`id`) " +
                                    "ON UPDATE CASCADE" +
                        ") " +
                    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=155;";

                await SQL.Query(query_auditlog);
                
                const query_authentication = 
                    "CREATE TABLE IF NOT EXISTS `authentication` " +
                        "(" +
                            "`id` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`time` varchar(25) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`ip` text CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                            "`role` varchar(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, " +
                                "PRIMARY KEY (`id`)" +
                        ") " +
                    "ENGINE=InnoDB DEFAULT CHARSET=ascii COLLATE=ascii_bin;";

                await SQL.Query(query_authentication);
                
                resolve();
            });
        });
    }
}

module.exports = SQL;