/* eslint-disable no-var */
/* eslint-disable prefer-const */
'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')
const UrlSetting = use('App/Models/UrlSetting')
const Session = use('App/Models/Session')

const moment = require('moment-timezone')

class ShortUrl extends Model {
  static get table() {
    return 'short_urls'
  }
  static get primaryKey() {
    return '_id'
  }
  static get deleteTimestamp() {
    return null
  }
  static get dateFormat() {
    return 'YYYY-MM-DD HH:mm:ss'
  }

  static get padding() {
    return 100
  }

  static get charSet() {
    return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  }

  static get domainRegEx() {
    return /:\/\/(.[^/]+)/
  }

  static get RegEx() {
    return {
      url_alias_invalid: /[~`!#$ .%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g,
      username_invalid: /[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/,
      email_valid: /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i,
      mobile_valid: /^(\+7|7|8)?[\s-]?\(?([0-9]{3})\)?[\s-]?([0-9]{3})[\s-]?([0-9]{2})[\s-]?([0-9]{2}).*$/gm,
      domain_match: /:\/\/(.[^/]+)/,
      alphanumeric_valid: /^[a-z0-9]+$/i,
      number_valid: /^\d+$/,
      decimal_number: /^[0-9]+\.?[0-9]*$/,
      alphanumeric_underscore_valid: /^[A-Za-z]\w*$/,
      valid_url: /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[_\W]).{12,20}$/,
      // Minimum ten and maximum 20 characters,one uppercase, lowercase, number, special character
      special_characters: /[~`!$%\^&+=\[\]';{}|":<>\?]/
    }
  }

  static async short(data) {
    var validation = await this.urlValidations(data)
    if (validation.status === true) {
      let thisModel = await this.createNew(data)
      return { status: true, data: thisModel }
    } else {
      return validation
    }
  }

  static async createNew(data) {
    let sessionModel
    let sessionId = null
    sessionModel = await Session.query('session', data.session_id).first()
    if (sessionModel) {
      sessionId = sessionModel.id
    } else sessionId = null
    let thisModel = new this()
    thisModel.original_url = data.original_url
    thisModel.session_id = sessionId
    thisModel.special_url =
      data.special_url && data.special_url.length ? data.special_url : null
    thisModel.domain = data.original_url.match(this.domainRegEx)[1]
    await thisModel.save()
    thisModel.short_url = this.encodedUrl(thisModel._id)
    thisModel.partition_index_number = thisModel.short_url.length
    thisModel.partition_index = thisModel.short_url.charAt(0)
    await thisModel.save()
    let urlSettingModel = new UrlSetting()
    urlSettingModel.url_id = thisModel._id
    urlSettingModel.session_id = sessionModel.id
    urlSettingModel.timezone = sessionModel.timezone
    urlSettingModel.user_name = data.user_name
    urlSettingModel.user_email = data.user_email
    urlSettingModel.user_mobile = data.user_mobile
    urlSettingModel.user_country = sessionModel.country_code
    urlSettingModel.user_state = sessionModel.state
    urlSettingModel.user_city = sessionModel.city
    urlSettingModel.show_ads =  data.display_ads
    urlSettingModel.record_stats = data.analytic_report
    urlSettingModel.expire_date = data.expire_date
    urlSettingModel.expire_time = data.expire_time
    await urlSettingModel.save()
    this.decodeUrl(thisModel.short_url)
    return thisModel
  }

  static encodedUrl(_id) {
    let paddedId = this.padding + _id
    let url = []
    while (paddedId > 0) {
      url.push(this.charSet.split('')[parseInt(paddedId % this.charSet.length)])
      paddedId = parseInt(paddedId / this.charSet.length)
      if (paddedId < 1) {
        paddedId = 0
      }
    }
    return url.reverse().join('')
  }

  static decodeUrl(shortUrl) {
    let _id = 0
    let chars = this.charSet.split('')
    for (let i = 0; i < shortUrl.length; i++) {
      _id = 62 * _id + chars.indexOf(shortUrl.charAt(i))
    }
    return _id
  }

  /**
   * @description Validation Rules for creating url
   * @param {*} data
   * @returns {status: Bool, errors: Object}
   */

  static async urlValidations(data) {
    let validation = { status: true, errors: {} }
    let aliasModel = await this.query()
      .select('_id')
      .where(function() {
        this.orWhere('special_url', data.special_url)
        this.orWhere('original_url', data.special_url)
      })
      .whereNotNull('special_url')
      .getCount()
    let currentTimezone = data.timezone || 'UTC'
    moment.tz.setDefault(currentTimezone)
    let currentDate = moment()
      .utc()
      .format('YYYYMMDD')
    let currentTime = moment()
      .utc()
      .format('HHmm')
    if (!data.original_url) {
      validation.errors.original_url = 'URL is Required.'
    }
    
    if (data.original_url &&
      data.original_url.length && !data.original_url.match(this.RegEx.valid_url)) {
      validation.errors.original_url = 'Invalid URL.'
    }

    if (
      data.special_url &&
      data.special_url.length &&
      data.special_url.match(this.RegEx.url_alias_invalid)
    ) {
      validation.errors.special_url =
        'URL Alias should not contain special characters except underscore (_) or hyphen (-).'
    }
    if (
      data.special_url &&
      data.special_url.match(this.RegEx.url_alias_invalid)
    ) {
      validation.errors.special_url = 'URL Alias Invalid.'
    }
    if (aliasModel) {
      validation.errors.special_url = 'URL Alias not available.'
    }
    if (data.expire_date) {
      data.expire_date = moment(data.expire_date, 'YYYY-MM-DD')
        .tz('UTC')
        .format('YYYYMMDD')
      if (data.expire_date < currentDate) {
        validation.errors.expire_date = 'Invalid date.'
      }
    }
    if (data.expire_time) {
      data.expire_time = moment(
        `1996-03-07 ${data.expire_time}`,
        'YYYY-MM-DD HH:mm'
      )
        .tz('UTC')
        .format('HHmm')
      if (data.expire_time < currentTime) {
        validation.errors.expire_time = 'Invalid date.'
      }
    }

    if (Object.keys(validation.errors).length) {
      validation.status = false
    }

    return validation
  }
}

module.exports = ShortUrl
