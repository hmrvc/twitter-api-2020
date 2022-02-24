// 引入套件
const passport = require('../config/passport')


// 使用passport jwt格式驗証方法，驗証傳入的token是否有登入
const authenticated = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    // 錯誤或user沒資料，回傳錯誤訊息
    if (err || !user) return res.status(401).json({ status: 'error', message: 'unauthorized' })

    next()
  })(req, res, next)
}

// 驗証是否是管理者
const authenticatedAdmin = (req, res, next) => {
  // 若有req.user且 該user.isAdmin為true， 進行下一步驟
  if (req.user && req.user.role === 'admin') return next()

  // 若為否，回傳狀態碼403，且回傳錯誤json資料
  return res.status(403).json({ status: 'error', message: 'permission denied' })
}

// 匯出模組
module.exports = {
  authenticated,
  authenticatedAdmin
}