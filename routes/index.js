var express = require('express');
const passport = require('passport');
var router = express.Router();
const userModel = require("./users");
const postModel = require("./posts");
const upload = require("./multer");
const path = require('path');
const fs = require('fs').promises;

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {error: req.flash('error')});
});


router.get('/signup', function(req, res, next) {
  res.render('signup');
});


router.get('/profile', isLoggedIn, async function ( req, res, next){
  const user = await userModel.findOne({
    username: req.session.passport.user
  })
  .populate("posts")
  res.render("profile", {user});
});

router.get('/show/posts', isLoggedIn, async function ( req, res, next){
  const user = await userModel.findOne({
    username: req.session.passport.user
  })
  .populate("posts")
  res.render("show", {user});
});

router.get('/feed', isLoggedIn, async function ( req, res, next){
  const user = await userModel.findOne({username: req.session.passport.user})
  const posts = await postModel.find()
  .populate("user")
  res.render("feed", {user, posts});
});

router.get('/addpost', isLoggedIn, async function ( req, res, next){
  const user = await userModel.findOne({
    username: req.session.passport.user
  })
  res.render("addpost", {user});
});

router.get('/feed', function(req, res, next) {
  res.render('feed');
});


router.post("/fileupload", isLoggedIn, upload.single("image"), async function(req, res, next){
  const user = await userModel.findOne({username: req.session.passport.user});
  user.profileImage = req.file.filename;
  await user.save();
  res.redirect("/profile");
})

router.post('/uploadpost', isLoggedIn ,upload.single("postimage"), async function(req, res, next) {
    if(!req.file){
      return res.status(400).send("No files were uploaded.")
    }
    const user = await userModel.findOne({username: req.session.passport.user});
    const post = await postModel.create({
      image: req.file.filename,
      title: req.body.title,
      description: req.body.description,
      user: user._id
    })

    user.posts.push(post._id)
    await user.save();
    res.redirect("/profile");
});



router.post("/register", function(req, res){
  const { username, email, fullname} = req.body;
  const userData = new userModel ({username, email, fullname});

  userModel.register(userData, req.body.password)
  .then(function(){
    passport.authenticate("local")(req, res, function(){
      res.redirect("/profile");
    })
  })
  })

router.post("/login", passport.authenticate("local", {
  successRedirect: "/profile",
  failureRedirect: "/", 
  failureFlash: true
}), function (req, res){
});


router.get("/logout", function(req, res, next){
  req.logOut(function(err){
    if (err) { return next (err); }
    res.redirect('/');
  });
})


function isLoggedIn(req, res, next){
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}


router.post('/deletepost/:postId', isLoggedIn, async function (req, res, next) {
  try {
    const postId = req.params.postId;

    // Find the post by ID and populate the user field
    const post = await postModel.findById(postId).populate('user');

    // Check if the post exists
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Ensure that the user making the request is the owner of the post
    if (post.user.username !== req.session.passport.user) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Remove the post from the user's posts array
    const user = await userModel.findById(post.user._id);
    user.posts.pull(postId);
    await user.save();

    // Construct the full path to the image file
    const imagePath = path.join(__dirname, '../public/images/uploads', post.image);

    console.log('Attempting to delete file at path:', imagePath);

    // Check if the file exists before attempting to delete
    const fileExists = await fs.access(imagePath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      console.log('File exists, attempting to delete...');

      // Delete the post from the database using findByIdAndDelete
      await postModel.findByIdAndDelete(postId);

      // Delete the associated image file
      await fs.unlink(imagePath);

      console.log('File deleted successfully.');

      // Respond with JSON indicating success
      res.json({ success: true, message: 'Post deleted successfully' });
    } else {
      console.log('File not found.');
      res.status(404).json({ success: false, message: 'Image file not found' });
    }
  } catch (error) {
    console.error('Error during post deletion:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});



module.exports = router;
