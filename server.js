const express = require("express")
const http = require("http")
const https = require("https")
const fileUpload = require("express-fileupload")
const methodOverride = require("method-override")
const session = require("express-session")
const bcrypt = require("bcrypt")
const fs = require("fs")
const app = express()
require("dotenv").config()
const userUploadsPath = process.env.USERUPLOADSDIR
const maxPostsPerPage = Number.parseInt(process.env.MAXPOSTSPERPAGE)
const timeBetweenPosts = Number.parseInt(process.env.TIMEBETWEENPOSTS)
const db = new (require("./db"))()
const sessionStore = new (require("express-mysql-session")(session))({ host: process.env.MYSQLURI, user: process.env.MYSQLUSER, password: process.env.MYSQLPASSWORD, database: process.env.MYSQLDBNAME })

let CreateLog;

app.set("view-engine", "ejs")
app.set("views", `${__dirname}/views`)

app.use(express.urlencoded({ extended: true }))
app.use(express.static(`${__dirname}/public/`))
app.use(methodOverride("_method"))
//app.use("user_uploads/:file", serveIndex("./user_uploads"))
app.use(session({ secret: "I like boys uwu", store: sessionStore, resave: false, saveUninitialized: false }))
app.use(fileUpload({ limits: { fileSize: 4000 * 1024 * 1024 }, limitHandler: (req, res, next) => {
    CreateLog(req, `Could not upload file. File too big`)
} }))
app.use((req, res, next) => {
    if (req.session.account)
    {
        db.updateAccountLastOnline(req.session.account.id)
    }

    next()
})

/*try {
    mongoose.connect(mongodbUri)
} catch (err)
{
    console.log(err)
}*/

app.get("/", async (req, res) => {
    let page = 1
    if (Number.parseInt(req.query.page)) page = req.query.page

    CreateLog(req, `GET request to page ${page} /`)
    
    let posts = await db.getPosts(null, page * maxPostsPerPage - maxPostsPerPage, maxPostsPerPage)

    if (posts.length === 0 && page !== 1)
    {
        res.redirect("/")
        return
    }

    let maxPage = Math.ceil((await db.getPostCount()) / maxPostsPerPage)
    
    res.render("index.ejs", { posts: posts, user: req.session.account, page: page, maxPage: maxPage })
})

app.post("/", async (req, res) => {
    CreateLog(req, `POST request to /`)

    if (!req.session.account)
    {
        res.redirect("login")
        CreateLog(req, "Could not create post. Must be logged in")
        return
    }

    if (req.body.title.length === 0)
    {
        CreateLog(req, `Could not create post. Post must contain a title`)
        res.render("post.ejs", { error: "Post must contain a title.", canPost: true })
    }
    
    if (req.body.title.length > 100)
    {
        res.render("post.ejs", { error: "Length of title can not be over 100 characters.", canPost: true })
        CreateLog(req, "Could not create post. Length of title must not be longer that 100 characters")
        return
    }

    if (req.body.description)
    {
        if (req.body.description.length > 1024)
        {
            CreateLog(req, `Could not create post. Length of description can not be over 1024 characters`)
            res.render("post.ejs", { error: "Description must not be longer than 1024 characters.", canPost: true })
            return
        }
    }
    
    if ((await db.getAccountTimeFromLastPost(req.session.account.id) < timeBetweenPosts) && !req.session.admin)
    {
        CreateLog(req, `Could not create post. Must wait between posts`)
        res.render("post.ejs", { error: `Calm down. You must wait ${timeBetweenPosts} seconds between making posts.`, canPost: false })
        return
    }
    
    let files = []
    
    if (req.files)
    {
        let date = new Date().toISOString().replace(/:/g, "_")

        if (!req.files.file.length)
        {
            let fileName = `${date}_${req.session.account.username}_${req.files.file.name}`
            let filePath = `${userUploadsPath}/${fileName}`
            console.log(fileName)
            console.log(filePath)
            console.log(req.files.file.mimetype)

            if (req.files.file.truncated)
            {
                CreateLog(req, `Could not upload file. File too big`)
                res.render("post.ejs", { error: "File too big.", canPost: true })
                return
            }
            
            try
            {
                await req.files.file.mv(filePath)
            } catch (err)
            {
                console.log(err)
                res.render("/post", { error: "An error has occured when saving files", canPost: true })
                return
            }

            files.push({ fileName: fileName, originalFileName: req.files.file.name, size: Math.round(((await fs.promises.stat(filePath)).size / (1024*1024)) * 1000) / 1000, mimeType: req.files.file.mimetype })
        } else
        {
            for (let i = 0; i < req.files.file.length; i++) {
                let fileName = `${date}_${req.session.account.username}_${req.files.file[i].name}`
                let filePath = `${userUploadsPath}/${fileName}`
                console.log(fileName)
                console.log(filePath)

                if (req.files.file[i].truncated)
                {
                    CreateLog(req, `Could not upload file. File too big`)
                    res.render("post.ejs", { error: "File too big.", canPost: true })
                    return
                }
                
                try
                {
                    await req.files.file[i].mv(filePath)
                } catch (err)
                {
                    console.log(err)
                    res.render("/post", { error: "An error has occured when saving files" })
                    return
                }
    
                files.push({ fileName: fileName, originalFileName: req.files.file[i].name, size: Math.round(((await fs.promises.stat(filePath)).size / (1024*1024)) * 1000) / 1000, mimeType: req.files.file[i].mimetype })
            }
        }
    }

    console.log("Files uploaded")
    
    try
    {
        post = await db.createPost(req.body.title, req.body.description, req.session.account.id, files)
        console.log("Post created")
        res.redirect("/")
    } catch (err)
    {
        console.log(err)
        res.render("post")
    }
})

app.get("/post", async (req, res) => {
    CreateLog(req, `GET request to /post`)

    if (!req.session.account)
    {
        res.redirect("/login")
        return
    }
    
    let timeFromLastPost = await db.getAccountTimeFromLastPost(req.session.account.id)
    let error
    let canPost = true

    if (timeFromLastPost < timeBetweenPosts && !req.session.admin)
    {
        error = `Calm down. You must wait ${timeBetweenPosts - timeFromLastPost} seconds before being able to post again`
        canPost = false
    }

    res.render("post.ejs", { error: error, canPost: canPost })
})

app.get("/post/:post", async (req, res) => {
    CreateLog(req, `GET request to /post/${req.params.post}`)

    let post = await db.getPostById(req.params.post)

    if (!post)
    {
        CreateLog(req, `Could not find post with id ${req.params.id}`)
        res.redirect("/")
        return
    }

    let files = await db.getPostFiles(req.params.post)
    db.increasePostViews(post.id)

    res.render("view.ejs", { post: post, files: files })
})

app.get("/login", (req, res) => {
    CreateLog(req, `GET request to /login`)

    if (req.session.account)
    {
        res.redirect("/")
        return
    }

    res.render("login.ejs", { error: "" })
})

app.post("/login", async (req, res) => {
    CreateLog(req, `POST request to /login`)

    let account = await db.getAccountByUsername(req.body.username)

    if (account)
    {
        if (await bcrypt.compare(req.body.password, account.password))
        {
            CreateLog(req, `User ${req.body.username} logged in`)
            req.session.account = account
            res.redirect("/")
            return
        }
    }

    CreateLog(req, `Could not log in to ${req.body.username}`)
    res.render("login.ejs", { error: "Username or password invalid." })
})

app.delete("/login", (req, res) => {
    CreateLog(req, `DELETE request to login`)
    req.session.account = null
    res.redirect("/")
})

app.get("/register", (req, res) => {
    CreateLog(req, `GET request to /register`)

    if (req.session.account)
    {
        res.redirect("/")
        return
    }

    res.render("register.ejs", { error: "", account: {} })
})

app.post("/register", async (req, res) => {
    CreateLog(req, `POST request to /register`)
    
    let account = {
        username: req.body.username,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword
    }
    
    if (await db.getAccountByUsername(req.body.username)) {
        CreateLog(req, `Could not create account with username ${req.body.username}. Username already exists`)
        res.render("register.ejs", { error: "Username already exists.", account: account })
        return
    }
    
    if (req.body.username.match("[^a-zA-Z0-9_]"))
    {
        CreateLog(req, `Could not create account with username ${req.body.username}. Username can not contain any special characters`)
        res.render("register.ejs", { error: "Username must not contain any special characters.", account: account })
        return
    }

    if (req.body.username.length > 20)
    {
        CreateLog(req, `Could not create account with username ${req.body.username}. Username must not be longer than 20 characters`)
        res.render("register.ejs", { error: "Username must not be longer that 20 characters.", account: account })
        return
    }

    if (req.body.password.length < 8)
    {
        CreateLog(req, `Could not create account with username ${req.body.username}. Password size is less than required length`)
        res.render("register.ejs", { error: "Password must be 8 characters or more.", account: account })
        return
    }

    if (req.body.password != req.body.confirmPassword)
    {
        CreateLog(req, `Could not create account with username ${req.body.username}. Passwords do not match`)
        res.render("register.ejs", { error: "Passwords do not match.", account: account })
        return
    }

    try
    {
        await db.createAccount(req.body.username, await bcrypt.hash(req.body.password, 10))
        CreateLog(req, `Account created with username ${req.body.username} ${req.body.password}`)
        req.session.account = await db.getAccountByUsername(req.body.username)
        res.redirect(`/user/${req.body.username}`)
    } catch (err)
    {
        console.log(err)
        res.render("/register", { error: "Could not create account." })
    }
})

app.get("/user_uploads/:file", async (req, res) => {
    CreateLog(req, `GET request to /user_uploads/${req.params.file}`)

    let file = await db.getFileByName(req.params.file)

    if (!file)
    {
        res.redirect("/")
        return
    }

    if (req.headers["sec-fetch-mode"] === "navigate") db.increaseFileViews(file.id)

    res.sendFile(`${userUploadsPath}/${req.params.file}`, { headers: { "Content-Disposition": `inline; filename="${file.originalFileName}"` } })
})

app.get("/user/:account", async (req, res) => {
    CreateLog(req, `GET request to /${req.params.account}`)

    let account = await db.getAccountByUsername(req.params.account)

    if (!account)
    {
        CreateLog(req, `Could not find account ${req.params.account}`)
        res.redirect("/")
        return
    }

    let posts = await db.getPosts(account.id)

    res.render("account.ejs", { account: account, posts: posts, user: req.session.account })
})

app.get("/user/:account/edit", async (req, res) => {
    CreateLog(req, `GET request to /user/${req.params.account}/edit`)
    
    if (!req.session.account)
    {
        CreateLog(req, `Access denied. Not logged in`)
        res.redirect("/")
        return
    }
    
    let account = await db.getAccountByUsername(req.params.account)

    if (!account)
    {
        CreateLog(req, `Could not find account ${req.params.account}`)
        res.redirect("/")
        return
    }

    if (req.session.account.id != account.id)
    {
        CreateLog(req, `Access denied. User IDs must be the same`)
        res.redirect(`/user/${req.params.username}`)
        return
    }

    res.render("edit.ejs", { account: account })
})

app.post("/user/:account/edit", async (req, res) => {
    CreateLog(req, `POST request to /user/${req.params.account}/edit`)
    
    if (!req.session.account)
    {
        CreateLog(req, `Access denied. Not logged in`)
        res.redirect("/")
        return
    }
    
    let account = await db.getAccountByUsername(req.params.account)

    if (!account)
    {
        CreateLog(req, `Could not find account ${req.params.account}`)
        res.redirect("/")
        return
    }

    if (req.session.account.id != account.id)
    {
        CreateLog(req, `Access denied. User IDs must be the same`)
        res.redirect(`/user/${req.params.username}`)
        return
    }

    await db.updateAccount([ { about: req.body.about }, account.id ])
    CreateLog(req, `Account ${req.params.account} edited`)
    res.redirect(`/user/${req.params.account}`)
})

app.delete("/post/:id", async (req, res) => {
    CreateLog(req, `DELETE request to /posts/${req.params.id}`)
    
    if (!req.session.account)
    {
        CreateLog(req, `Could not delete post. Not authorized`)
        res.redirect("/")
        return
    }

    let post = await db.getPostById(req.params.id)

    if (!post)
    {
        CreateLog(req, `Post ${req.params.id} does not exist`)
        res.redirect("/")
    }

    if (!req.session.account.admin && req.session.account.id !== post.userId)
    {
        CreateLog(req, `Could not delete post. Not authorized`)
        res.redirect("/")
        return
    }

    await db.deletePost(req.params.id)
    
    CreateLog(req, `Post ${req.params.id} deleted`)
    res.redirect("/")
})

app.get("/about", (req, res) => {
    CreateLog(req, `GET request to /about`)
    res.render("about.ejs")
})

function CreateLogFileDump(req, text)
{
    let log = `${(new Date()).toLocaleString()} File Dump ${req.ip} ${req.session.account ? req.session.account.username : "Not logged in"} ${text}`
    console.log(log)
    fs.appendFile("log.txt", `${log}\n`, (err) => {
        if (err) console.log(err)
    })
}

function SetLoggingFunction(func)
{
    CreateLog = func
}

httpServer = http.createServer(app)
httpsServer = https.createServer({ privateKey: "", certificate: "" }, app)

//httpServer.listen(80)
//httpsServer.listen(443)

//app.listen(80)

module.exports = app
module.exports.SetLoggingFunction = SetLoggingFunction