/* eslint-disable camelcase */
<template>
  <div style="">
    <a-col :span="12">
      <a-card class="card-wrapper">
        <a-form ref="form" :model="formData" label-width="100px">

          <a-form-item label="SIP 账号:">
            <a-input v-model="formData.account" placeholder="1005"></a-input>
          </a-form-item>
          <a-form-item label="SIP 密码:">
            <a-input v-model="formData.password" placeholder="SIP 密码"></a-input>
          </a-form-item>
          <a-form-item label="FreeSwitch Host:">
            <a-input v-model="formData.host" placeholder="192.168.0.104"></a-input>
          </a-form-item>
          <a-form-item label="SIP 呼叫地址:">
            <a-input v-model="formData.callPhoneUri" placeholder="例如: 1008"></a-input>
          </a-form-item>
          <a-form-item class="submit-form-item">
            <a-button type="primary" @click="initSipParams"> 初始化 </a-button>
            <a-button type="success" @click="callPhone" :disabled="formData.callDisable"> Call </a-button>
            <a-button id="endCall" type="error"> 挂断 </a-button>
          </a-form-item>
        </a-form>
      </a-card>
    </a-col>
    <a-col :span="12">
      <a-card class="card-wrapper">
        <video id="localVideo" muted="muted" hidden></video>
        <video id="remoteVideo"></video>
      </a-card>
    </a-col>
  </div>
</template>

<script>
import { Web } from 'sip.js'
// import Sipphone from '@/utils/sipphone'
// import SimpleUser from '@/utils/simple-user'

export default {
  name: 'BaseForm',
  data () {
    return {
      formData: {
        host: '172.16.20.253',
        port: 7443,
        transport: 'wss',
        protocol: 'sip',
        account: '1005',
        password: '123456',
        callDisable: true
      },
      // 铃声
      incomingCallAudio: null,
      simpleUser: null
    }
  },
  methods: {
    // 初始换铃声
    initIncomingCallAudio () {
      this.incomingCallAudio = new window.Audio('http://study.closeeyes.cn/incoming-call-ringtone.mp3')
      this.incomingCallAudio.loop = true
    },
    // 初始化sip参数
    async initSipParams () {
      if (!this.formData.account) return this.$message.error('请填写分机号！')
      if (!this.formData.password) return this.$message.error('请填写分机密码！')
      // eslint-disable-next-line camelcase
      const ws_server = `${this.formData.transport}://${this.formData.host}:${this.formData.port}`
      const options = {
        aor: `${this.formData.protocol}:${this.formData.account}@${this.formData.host}:${this.formData.port}`, // caller
        media: {
          constraints: {
            audio: true,
            video: true
          },
          local: {
            video: document.getElementById('localVideo')
          },
          remote: {
            video: document.getElementById('remoteVideo')
          }
        },
        userAgentOptions: {
          displayName: this.formData.account,
          contactName: this.formData.account,
          contactParams: {
            transport: this.formData.transport
          },
          transportOptions: {
            server: ws_server
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
          reconnectionAttempts: 100, // 重连次数
          reconnectionDelay: 5, // 重连延迟
          hackWssInTransport: true,
          hackIpInContact: this.formData.host,
          authorizationUsername: this.formData.account,
          authorizationPassword: this.formData.password,
          allowLegacyNotifications: true,
          registerExpires: 600,
          traceSip: true,
          log: {
            builtinEnabled: false,
            // level, category, label, content
            // connector: (...args) => {
            //   console.log(args)
            // },
            level: 'debug' // "debug", "log", "warn", "error"
          }
        }
      }
      this.simpleUser = new Web.SimpleUser(ws_server, options)
      const endButton = document.getElementById('endCall')
      endButton.addEventListener(
        'click',
        async () => {
          await this.simpleUser.hangup()
          alert('Call Ended')
        },
        false
      )
      // 状态监听
      this.simpleUser.delegate = {
        onServerConnect: () => {
          console.log(`Server Connect...`)
        },
        onServerDisconnect: () => {
          console.log(`Server Disconnect...`)
        },
        onRegistered: () => {
          console.log(`Registered...`)
        },
        onUnregistered: () => {
          console.log(`Unregistered...`)
        },
        onMessageReceived: (message) => {
          console.log('收到消息', message)
        },
        onCallCreated: () => {
          console.log('Call Created...')
        },
        onCallAnswered: () => {
          console.log('Call Answered...')
        },
        onCallReceived: async () => {
          console.log('来电session...', this.simpleUser.session)
          const number = this.simpleUser.session.remoteIdentity.uri.user
          const displayName = this.simpleUser.session.remoteIdentity.displayName
          console.log('来电名称', number)
          console.log('来电号码', displayName)
          const _this = this
          this.$confirm({
            title: `用户${displayName}来电，是否接听?`,
            content: number,
            onOk () {
              _this.simpleUser.answer()
            },
            onCancel () {
              _this.simpleUser.hangup()
            }
          })
        },
        onCallHangup: () => {
            console.log('Call Hangup...')
        }
      }
      // Connect to server and place call
      this.simpleUser
        .connect()
        .then(() => {
          console.log('连接成功！')
          this.simpleUser.register()
        })
        .catch(error => {
          console.log('sip连接失败', error)
          // Call failed
        })
      this.formData.callDisable = false
    },

    callPhone () {
      if (!this.formData.callPhoneUri) {
        this.$message.error('请填写被叫叫分机号！')
        return
      }
      const callNumber = `${this.formData.protocol}:${this.formData.callPhoneUri}@${this.formData.host}`
      this.simpleUser.call(callNumber)
    }
  }
}
</script>
