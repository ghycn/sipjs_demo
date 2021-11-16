import { UserAgent, Registerer, Inviter, SessionState, Invitation, Subscriber, SubscriptionState } from 'sip.js'
// import { EventEmitter } from './EventEmitter'
class SipPhone {
  constructor (account, server) {
    this.sipAccount = account
    this.sipServers = server
    // ua 实例
    this.SipUA = null
    // 媒体 audio dom
    this.mediaAudioDom = null
    // 当前电话 invite 返回值
    this.sessionall = null
    // 自定义事件
    // this.EventEmitter = new EventEmitter()
    // this.on = this.EventEmitter.on
    // this.emit = this.EventEmitter.emit
  }

  get sipConfig () {
    console.log(this.sipAccount)
    // const userAgent = `${this.sipAccount.no}@${this.sipServers[0].server}`
    const uri = UserAgent.makeURI(`sip:${this.sipAccount.no}@${this.sipServers[0].server}`)
    const wsServers = this.sipServers.map(item => `${item.protocol}://${item.server}:${item.port}`)
    const config = {
      uri,
      contactParams: {
        transport: 'wss'
      },
      transportOptions: {
        wsServers,
        maxReconnectionAttempts: 99999999, // 两年
        reconnectionTimeout: 5
      },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionOptions: {
          rtcConfiguration: {
            iceServers: [
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun.fwdnet.net' },
              { urls: 'stun:stun.ekiga.net' },
              { urls: 'stun:stun.ideasip.com' }
            ]
          }
        }
      },
      authorizationUsername: this.sipAccount.no,
      authorizationPassword: this.sipAccount.pwd,
      allowLegacyNotifications: true,
      autostart: true,
      register: true,
      registerExpires: 60,
      traceSip: false,
      log: {
        builtinEnabled: false,
        // level, category, label, content
        // connector: (...args) => {
        //   console.log(args)
        // },
        level: 'log' // "debug", "log", "warn", "error"
      }
      // rel100: SIP.C.supported.SUPPORTED
    }
    return config
  }

  init () {
    // if (!remoteAudio) return new Error('请确定audio dom 存在')

    const config = this.sipConfig
    console.log(config)
    this.SipUA = new UserAgent(config)

    // const registererOptions = { /* ... */ }
    // const registerer = new Registerer(this.SipUA)

    this.SipUA.start().then(() => {
      console.log('Connected')
      const registerer = new Registerer(this.SipUA)
      registerer.register()
    })
    // eslint-disable-next-line handle-callback-err
    .catch((error) => {
      console.error(error)
      console.error('Failed to connect')
    })
    // 绑定事件
    this.bindSipUAEvents()
    this.mediaAudioDom = '#remoteAudio'
    return this.SipUA
  }

  // 绑定 ua 回调事件
  bindSipUAEvents () {
    this.SipUA.delegate = {
      // 当连接到server时的回调
      onConnect: () => {
        console.log('Network connectivity established')
      },
      // 当用户断开连接时
      onDisconnect: (error) => {
        console.log('Network connectivity lost')
        if (!error) {
          console.log('User agent stopped')
        }
      },
      // 当UA被其他用户拨打时（也就说呼入的时候）
      onInvite: (invitation) => {
        console.log('INVITE received')
        this.sessionall = invitation
        this.sessionall.accept()
      },
      onMessage: (message) => {
        console.log('MESSAGE received')
        message.accept()
      },
      onNotify: (notification) => {
        console.log('NOTIFY received')
        console.log(notification)
        notification.accept()
      },
      onRefer: (referral) => {
        console.log('REFER received')
        referral.accept()
      },
      onSubscribe: (subscription) => {
        console.log('SUBSCRIBE received')
        // referral.accept()
      }
    }
  }

  // 呼出
  async inviteCall (callNumber) {
    if (!callNumber) return new Error('请确定电话号码存在')
    // if (this.sessionall) {
    //   this.sessionall.close()
    // }
    const target = UserAgent.makeURI(
      'sip:' + callNumber + '@' + this.sipServers[0].server
    )
    if (!target) {
      throw new Error('Failed to create target URI.')
    }
    this.sessionall = new Inviter(this.SipUA, target)
    // this.sessionall = await this.SipUA.invite(callNumber)
    this.sessionall.invite().then(() => {
      // INVITE sent
    }).catch((err) => {
      console.error('呼叫失败', err)
    })
    this.bindInviteEvent(this.sessionall, this.mediaAudioDom)
  }

  // 订阅
  subscribe (callNumber) {
    // Delegate for handling notifications
    const delegate = {
      expires: 300,
      onNotify: (notification) => {
        const body = notification.request.body
        console.log('Received notification: \n' + body)

        // Send reply
        notification.accept()

        // Send un-SUBSCRIBE
        // subscription.unsubscribe()
        //   .then(() => {
        //     console.log('Successfully sent un-SUBSCRIBE')
        //   })
        //   .catch((error) => {
        //     console.error(error)
        //     console.log('Failed to send un-SUBSCRIBE')
        //   })
      }
    }
    // Create subscription
    const target = UserAgent.makeURI(
      'sip:' + callNumber + '@' + this.sipServers[0].server
    )
    const subscription = new Subscriber(this.SipUA, target, 'presence', { delegate })
    console.log(subscription)
    // Setup subscription state change handler
    subscription.stateChange.addListener((newState) => {
      switch (newState) {
        case SubscriptionState.Subscribed:
          console.log('Subscription started')
          break
        case SubscriptionState.Terminated:
          console.log('Subscription ended')
          break
      }
    })

    // Send initial SUBSCRIBE
    subscription.subscribe().then(() => {
        console.log('Successfully sent SUBSCRIBE')
      }).catch((error) => {
        console.log(error)
        console.log('Failed to send SUBSCRIBE')
      })
  }
  // 挂断
  hangUp () {
    if (!this.sessionall) {
      return new Error('会话状态不存在！')
    }
    console.log(this.sessionall)
    switch (this.sessionall.state) {
      case SessionState.Initial:
        if (this.sessionall instanceof Inviter) {
          return this.sessionall.cancel().then(() => {
            console.log(`Inviter never sent INVITE (canceled)`)
          })
        } else if (this.sessionall instanceof Invitation) {
          return this.sessionall.reject().then(() => {
            console.log(`Invitation rejected (sent 480)`)
          })
        } else {
          throw new Error('Unknown session type.')
        }
      case SessionState.Establishing:
        if (this.sessionall instanceof Inviter) {
          return this.sessionall.cancel().then(() => {
            console.log(`Inviter canceled (sent CANCEL)`)
          })
        } else if (this.sessionall instanceof Invitation) {
          return this.sessionall.reject().then(() => {
            console.log(`Invitation rejected (sent 480)`)
          })
        } else {
          throw new Error('Unknown session type.')
        }
      case SessionState.Established:
        return this.sessionall.bye().then(() => {
          console.log(`Session ended (sent BYE)`)
        }).catch((error) => {
          console.log('SIPJS Error Terminanting UA....', error)
        })
      case SessionState.Terminating:
        console.log('SessionState.Terminating')
        break
      case SessionState.Terminated:
        alert('terminated')
        break
      default:
        throw new Error('Unknown state')
    }
  }
  // 绑定来电状态
  bindInviteEvent (sessionall, mediaAudioDom) {
    // Setup session state change handler
    sessionall.stateChange.addListener((newState) => {
      switch (newState) {
        case SessionState.Establishing:
          console.log('Ringing')
          break
        case SessionState.Established:
          console.log('Answered')
            const pc = sessionall.sessionDescriptionHandler.peerConnection
            const AUDIO_DOM = document.querySelector(mediaAudioDom)
            const remoteStream = new MediaStream()
            pc.getReceivers().forEach(function (receiver) {
              remoteStream.addTrack(receiver.track)
            })
            // 普通电话在remoteAudio直接播放
            AUDIO_DOM.srcObject = remoteStream
            AUDIO_DOM.play()
          break
        case SessionState.Terminated:
          console.log('Ended')
          break
      }
    })
  }
}
export default SipPhone
