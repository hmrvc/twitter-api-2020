const express = require('express')
const router = express.Router()
const { errorHandler } = require('../middleware/error-handler')
const user = require('./modules/user')
const admin = require('./modules/admin')
const { authenticated, authenticatedAdmin } = require('../middleware/auth')
const userController = require('../controllers/userController')
const adminController = require('../controllers/adminController')

//登入註冊功能路由
router.post('/users/signin', userController.signIn)
router.post('/users', userController.signUp)
router.post('/admin/signin', adminController.signIn)

// 功能路由
router.use('/users', authenticated, user)
router.use('/admin', authenticated, admin)
router.use('/', errorHandler)

module.exports = router