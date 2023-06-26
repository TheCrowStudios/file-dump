let Account
let Post
let UploadedFile
let mongoose
let mysql
let mysqlConnection

/**
 * Provides functions for working with the specified database.
 */
class db
{
    constructor(db)
    {
        switch(db)
        {
            case "mongodb":
                Account = require("./models/account")
                Post = require("./models/post")
                UploadedFile = require("./models/uploadedFile")
                mongoose = require("mongoose")
                break
            case "mysql":
                mysql = require("mysql")
                mysqlConnection = mysql.createPool({ host: process.env.MYSQLURI, user: process.env.MYSQLUSER, password: process.env.MYSQLPASSWORD, database: process.env.MYSQLDBNAME })
                mysqlConnection.getConnection((err, connection) => {
                    if (err) console.log(err)
                })
                break
            case "mysql2":
                mysql = require("mysql2")
                mysqlConnection = mysql.createPool({ host: process.env.MYSQLURI, user: process.env.MYSQLUSER, password: process.env.MYSQLPASSWORD, database: process.env.MYSQLDBNAME })
                mysqlConnection.getConnection((err, connection) => {
                    if (err) console.log(err)
                })
                break
        }
    }
    
    /**
     * Returns an object containing information of the account with the specified id.
     * @param {Number} id 
     * @returns Returns account object.
     */
    async getAccountById(id)
    {
        if (mongoose)
        {
            return Account.findById(id)
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT * FROM accounts WHERE id = ?", { id })).results[0]
        }
    }

    /**
     * Returns an object containing information of the account with the specified username.
     * @param {String} username 
     * @returns Returns account object.
     */
    async getAccountByUsername(username)
    {
        if (mongoose)
        {
            return Account.findOne({ username: username })
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT * FROM accounts WHERE username = ?", username)).results[0]
        }
    }

    /**
     * Returns the time in seconds from the last post created by the account with the specified id.
     * @param {Number} id 
     * @returns Returns number of seconds from last post for the account.
     */
    async getAccountTimeFromLastPost(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            let time = (await mysqlQueryWrapper("SELECT TIMESTAMPDIFF(SECOND, (SELECT MAX(created) FROM posts WHERE userId = ?), ?) time", [id, mysql.raw("CURRENT_TIMESTAMP()")])).results[0].time

            if (!time) return 9999
            return time
        }
    }

    /**
     * Returns an object containing information of the file with the specified id.
     * @param {Number} id 
     * @returns Returns file object.
     */
    async getFileById(id)
    {
        if (mongoose)
        {
            return UploadedFile.findById(id)
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT * FROM files WHERE ?", { id })).results[0]
        }
    }

    /**
     * Returns an object containing information of the file with the specified name.
     * @param {String} name 
     * @returns Returns file object.
     */
    async getFileByName(name)
    {
        if (mongoose)
        {
            return UploadedFile.findOne({ fileName: name })
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT * FROM files WHERE fileName = ?", name)).results[0]
        }
    }

    /**
     * Inserts a row into the database containing the information provided about a file.
     * @param {String} fileName 
     * @param {String} originalFileName 
     * @param {Number} size 
     * @param {Number} userId 
     * @returns 
     */
    async createFile(fileName, originalFileName, size, userId)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("INSERT INTO files SET ?", { fileName, originalFileName, size, userId })
        }
    }

    /**
     * Creates a row in the database that links a file with a post.
     * @param {Number} postId 
     * @param {Number} fileId 
     * @returns 
     */
    async createPostFile(postId, fileId)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("INSERT INTO postFiles SET ?", { postId, fileId })
        }
    }

    /**
     * Returns an object containing information of the post with the specified id along with the username of the poster.
     * @param {Number} id 
     * @returns Object containing the post.
     */
    async getPostById(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT p.*, a.username FROM posts p INNER JOIN accounts a ON p.userId = a.id WHERE p.id = ?", id)).results[0]
        }
    }
    
    /**
     * Returns an object containing information of the files linked to the post with the specified id.
     * @param {Number} id 
     * @returns Object containing the retrieved files.
     */
    async getPostFiles(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT f.* FROM files f INNER JOIN postFiles pf ON f.id = pf.fileId WHERE pf.postId = ?", id)).results
        }
    }
    
    /**
     * Gets all the posts sorted in by date created in descending order with the username of the poster and the number of files in the post.
     * @param {Number} userId The id of the user account from which to get posts.
     * @returns Object containing the retrieved posts.
     */
    async getPosts(userId, sort, start, rows)
    {
        if (mongoose)
        {
            if (userId)
            {
                Post.find({ userId: account.id }).sort({ created: "desc" })
            }
            
            return Post.find().sort({ created: "desc" })
        }

        if (mysqlConnection)
        {
            if (userId)
            {
                return (await mysqlQueryWrapper(`SELECT * FROM posts WHERE userId = ? ORDER BY ${sort} DESC`, [ userId ])).results
            }
            
            return (await mysqlQueryWrapper(`SELECT p.*, a.username, (SELECT COUNT(*) FROM postFiles WHERE postId = p.id) files FROM posts p INNER JOIN accounts a ON p.userId = a.id ORDER BY ${sort} DESC LIMIT ?, ?`, [start, rows])).results
        }
    }

    /**
     * Returns the total number of posts.
     * @returns Number of posts.
     */
    async getPostCount()
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT COUNT(*) count FROM posts")).results[0].count
        }
    }

    /**
     * Creates an entry in the posts table, an entry for each file in the files table and links the files with the post in the postFiles table.
     * @param {String} title The title of the post.
     * @param {Number} userId The id of the account creating the post.
     * @param {*} files An array containing object which define the file name, original file name and size of the uploaded files.
     * @returns 
     */
    async createPost(title, description, userId, files)
    {
        if (mongoose)
        {
            let file
            
            file = new UploadedFile({
                fileName: fileName,
                originalFileName: req.files.file.name
            })

            if (file) file = await file.save()

            let post = new Post({
                title: req.body.title,
                fileName: fileName,
                originalFileName: req.files.file.name,
                files: files,
                userId: req.session.account._id,
                size: Math.round(((await fs.promises.stat(filePath)).size / (1024*1024)) * 1000) / 1000
            })
            
            return post.save()
        }

        if (mysqlConnection)
        {
            await mysqlQueryWrapper("INSERT INTO posts SET ?", { title, description, userId })
            let postId = (await mysqlQueryWrapper("SELECT * FROM posts WHERE userId = ? ORDER BY created DESC", userId)).results[0].id

            console.log(files)
            
            if (files)
            {
                for (let i = 0; i < files.length; i++) {
                    files[i].userId = userId
                    await mysqlQueryWrapper("INSERT INTO files SET ?", files[i])
                    let fileId = (await mysqlQueryWrapper("SELECT * FROM files WHERE fileName = ?", files[i].fileName)).results[0].id
                    mysqlQueryWrapper("INSERT INTO postFiles SET ?", { postId, fileId })
                }
            }

            //let fileId = (await mysqlQueryWrapper("SELECT * FROM files WHERE fileName = ?", fileName)).results[0].id

            return
        }
    }

    async deletePost(id)
    {
        if (mongoose)
        {
            return
        }
        
        if (mysqlConnection)
        {
            return mysqlQueryWrapper("DELETE FROM posts WHERE id = ?", id)
        }
    }

    async getComments(postId)
    {
        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT c.*, a.username FROM comments c INNER JOIN accounts a ON a.id = c.userId WHERE c.postId = ? ORDER BY created DESC", postId)).results
        }
    }

    async getCommentById(id)
    {
        if (mysqlConnection)
        {
            return (await mysqlQueryWrapper("SELECT * FROM comments WHERE id = ?", id)).results[0]
        }
    }
    
    async createComment(comment, postId, userId)
    {
        if (mysqlConnection)
        {
            return mysqlQueryWrapper("INSERT INTO comments SET ?", { comment: comment, postId: postId, userId: userId })
        }
    }
    
    async deleteComment(id)
    {
        if (mysqlConnection)
        {
            return mysqlQueryWrapper("DELETE FROM comments WHERE id = ?", id)
        }
    }

    async getAccountTimeFromLastComment(id)
    {
        if (mysqlConnection)
        {
            let time = (await mysqlQueryWrapper("SELECT TIMESTAMPDIFF(SECOND, (SELECT MAX(created) FROM comments WHERE userId = ?), ?) time", [id, mysql.raw("CURRENT_TIMESTAMP()")])).results[0].time

            if (time === null) return 9999
            return time
        }
    }

    /**
     * Creates an entry for an account with the specified details in the accounts table.
     * @param {String} username The username of the account/
     * @param {String} password The hashed password.
     * @returns 
     */
    async createAccount(username, password)
    {
        if (mongoose)
        {
            let account = new Account({
                username: username,
                password: password
            })

            return account.save()
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("INSERT INTO accounts SET ?", { username, password })
        }
    }

    /**
     * Updates an account with the id and sets new values for any field provided.
     * @param {*} account An array containing an object with  any new information to be updated and the account id after the object.
     * @returns 
     */
    async updateAccount(account)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("UPDATE accounts SET ? WHERE id = ?", account)
        }
    }

    /**
     * Updates the last online timestamp of the account to the current time on the server.
     * @param {Number} id The id of the account.
     * @returns 
     */
    async updateAccountLastOnline(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return this.updateAccount([{ lastOnline: mysql.raw("CURRENT_TIMESTAMP()") }, id])
        }
    }

    async increasePostViews(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("UPDATE posts SET views = views + 1 WHERE id = ?", id)
        }
    }

    async increaseFileViews(id)
    {
        if (mongoose)
        {
            return
        }

        if (mysqlConnection)
        {
            return mysqlQueryWrapper("UPDATE files SET views = views + 1 WHERE id = ?", id)
        }
    }
}

function mysqlQueryWrapper(query, params)
{
    return new Promise((resolve, reject) => {
        mysqlConnection.query(query, params, (err, results, fields) => {
            if (!err) resolve({ results, fields })
            reject(err)
        })
    })
}

module.exports = db