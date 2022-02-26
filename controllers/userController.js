const jwt = require('jsonwebtoken')
const { imgurFileHandler } = require('../helpers/file-helper')
const { User, Tweet, Like, Reply } = require('../models')
const helpers = require('../_helpers')
const bcrypt = require('bcryptjs')


const userController = {
  signIn: (req, res, next) => {
    // 從req取資料
    const { account, password } = req.body

    // 以account取user data
    return User.findOne({ where: { account } })
      .then(user => {
        // 判斷使用者是否存在
        if (!user) return res.json({ status: 'error', message: '帳號與密碼不存在' })
        user = user.toJSON()

        return bcrypt.compare(password, user.password)
          .then(isCorrect => {
            // 判斷密碼與使用者身份是否正確
            if (!isCorrect) return res.json({ status: 'error', message: '帳號與密碼不存在' })
            if (user.role !== 'user') return res.json({ status: 'error', message: '帳號與密碼不存在' })

            // 透過jwt簽發token
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' })
            delete user.password
            // 傳給用戶端
            return res.json({
              status: 'success',
              data: {
                token,
                user
              }
            })
          })
          .catch(err => next(err))
      })
  },
  signUp: (req, res, next) => {
    const { account, name, email, password, checkPassword } = req.body
    // 欄位不能空白
    if (!account || !name || !email || !password || !checkPassword) {
      return res.json({ status: 'error', message: '欄位不可空白' })
    }
    // password 與 checkPassword 不相同
    if (password !== checkPassword) {
      return res.json({ status: 'error', message: '確認密碼錯誤' })
    }
    // name 字數 < 50
    if (name.length > 50) {
      return res.json({ status: 'error', message: '名稱字數最多 50 字' })
    }
    // account email 已經被使用
    return Promise.all([
      User.findOne({ where: { account } }),
      User.findOne({ where: { email } })
    ])
      .then(([accountUser, emailUser]) => {
        if (accountUser) {
          return res.json({ status: 'error', message: 'account 已重複註冊!' })
        }
        if (emailUser) {
          return res.json({ status: 'error', message: 'email 已重複註冊!' })
        }
        return User.create({
          account,
          name,
          email,
          password: bcrypt.hashSync(password, 10),
          role: 'user'
        })
      })
      .then(user => {
        res.json({ status: 'success', message: '註冊成功', user })
      })
  },
  // 使用者頁面
  getUser: (req, res, next) => {
    const currentUser = helpers.getUser(req)
    return User.findByPk(req.params.id, {
      // raw: true,
      // nest: true,
      include: [
        { model: User, as: "Followings" },
        { model: User, as: "Followers" }
      ]
    })
      .then(user => {
        if (!user) throw new Error("User didn't exist!")
        user.dataValues.followingCount = user.Followings?.length
        user.dataValues.follwerCount = user.Followers?.length
        user.dataValues.isFollowed = user.Followers?.some(id => id === currentUser.id)
        res.json(user)
      })
      .catch(err => next(err))
  },
  // 回覆過的推文
  getRepliedTweets: (req, res, next) => {
    return Reply.findAll({
      where: { UserId: req.params.id },
      include: [User, { model: Tweet, include: [{ model: User, attributes: ['name', 'account'] }] }
      ]
    })
      .then(replies => {
        res.json(replies)
      })
      .catch(err => next(err))
  },
  // 使用者推文
  getUserTweets: (req, res, next) => {
    // 使用helpers取得登入者資訊
    const currentUser = helpers.getUser(req)

    // 取出user與tweet資料
    return Promise.all([
      User.findByPk(req.params.id),
      Tweet.findAll({
        where: { UserId: req.params.id },
        include: [User, Reply, Like],
        order: [['createdAt', 'DESC']]
      })
    ])
      .then(([user, tweet]) => {
        // 判斷是否有該查詢使用者
        if (!user) throw new Error("User didn't exist!")

        // 將tweet迭代，並回傳所以資料陣列
        const tweets = tweet.map(tweet => ({
          ...tweet.dataValues,
          likedCount: tweet.Likes.length,
          repliedCount: tweet.Replies.length,
          isLiked: tweet.Likes.map(user => user.UserId).includes(currentUser.id)
        }))
        res.json(tweets)
      })
      .catch(err => next(err))
  },
  // 喜歡的推文
  getLikedTweet: (req, res, next) => {
    return Like.findAll({
      where: { UserId: req.params.id },
      include: [{
        model: Tweet,
        include: [{ model: User },
          Reply,
          Like
        ]
      }],
    })
      .then(likes => {
        likes = likes.map(like => ({
          ...like.dataValues,
        }))
        res.json(likes)
      })
      .catch(err => next(err))
  },
  getFollowings: (req, res, next) => {
    // 依req的id從User抓資料
    return User.findByPk(req.params.id, {
      include: [{
        model: User, as: 'Followings'
      }]
    })
      .then(user => {
        // 判斷是否有使用者
        if (!user) throw new Error("User didn't exist!")
        user = user.toJSON()
        // 將usee.following從物件拿出
        const Followings = user.Followings
        // 將followings迭代，並將id重新命名為followingId，並回傳成陣列
        const data = Followings.map(following => {
          return {
            followingId: following.id,
            account: following.account,
            email: following.email,
            avatar: following.avatar,
            cover: following.cover,
            introduction: following.introduction,
            followerUser: {
              followerId: user.id,
              name: user.name
            }
          }
        })

        res.json(data)
      })
      .catch(err => next(err))
  },
  getFollowers: (req, res, next) => {
    return User.findByPk(req.params.id, {
      include: [{
        model: User, as: 'Followers'
      }]
    })
      .then(user => {
        // 判斷是否有使用者
        if (!user) throw new Error("User didn't exist!")
        // 將usee.Followers從物件拿出
        user = user.toJSON()
        const followers = user.Followers
        // 將followings迭代，並將id重新命名為followingId，並回傳成陣列
        const data = followers.map(follower => {
          return {
            followerId: follower.id,
            account: follower.account,
            email: follower.email,
            avatar: follower.avatar,
            cover: follower.cover,
            introduction: follower.introduction,
            followingUser: {
              followingId: user.id,
              name: user.name,
            }
          }
        })
        res.json(data)
      })
      .catch(err => next(err))
  },
  // 編輯自介相關資料
  putUser: (req, res, next) => {
    const { name, introduction } = req.body
    const currentUser = helpers.getUser(req)
    // 只能編輯自己的資料
    if (Number(req.params.id) !== currentUser.id) {
      return res.json({ status: 'error', message: '權限錯誤' })
    }
    // 修改限制
    if (name && name.length > 50) {
      return res.json({ status: 'error', message: '名稱字數最多 50 字' })
    }
    if (introduction && introduction.length > 160) {
      return res.json({ status: 'error', message: '自介字數最多 160 字' })
    }

    const { files } = req
    const avatarfile = files ? files.avatar[0] : null
    const coverfile = files ? files.cover[0] : null

    return Promise.all([
      User.findByPk(currentUser.id),
      imgurFileHandler(avatarfile),
      imgurFileHandler(coverfile),
    ])
      .then(([user, avatarPath, coverPath]) => {
        return user.update({
          name,
          introduction,
          avatar: avatarPath || user.avatar,
          cover: coverPath || user.cover,
        })
      })
      .then(user => {
        res.json({ status: 'success', user })
      })
      .catch(err => next(err))
  },
  // 編輯帳號密碼相關資料
  editUser: (req, res, next) => {
    const { account, name, email, password, checkPassword } = req.body
    const currentUser = helpers.getUser(req)
    // 只能編輯自己的資料
    if (Number(req.params.id) !== currentUser.id) {
      return res.json({ status: 'error', message: '權限錯誤' })
    }
    // 欄位不能空白
    if (!account || !name || !email || !password || !checkPassword) {
      return res.json({ status: 'error', message: '欄位不可空白' })
    }
    // password 與 checkPassword 不相同
    if (password !== checkPassword) {
      return res.json({ status: 'error', message: '確認密碼錯誤' })
    }
    // name 字數 < 50
    if (name.length > 50) {
      return res.json({ status: 'error', message: '名稱字數最多 50 字' })
    }
    // account email 已經被使用
    return Promise.all([
      User.findByPk(req.params.id),
      User.findOne({ where: { account } }),
      User.findOne({ where: { email } })
    ])
      .then(([user, accountUser, emailUser]) => {
        if (accountUser && accountUser.account !== user.account) {
          return res.json({ status: 'error', message: 'account 已重複註冊!' })
        }
        if (emailUser && emailUser.email !== user.email) {
          return res.json({ status: 'error', message: 'email 已重複註冊!' })
        }
        return user.update({
          account,
          name,
          email,
          password: bcrypt.hashSync(password, 10)
        })
      })
      .then(user => {
        res.json({ status: 'success', message: '資料編輯成功', user })
      })
      .catch(err => next(err))
  }


}

module.exports = userController