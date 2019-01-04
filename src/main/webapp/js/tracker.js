/**
 * Created by 贵斌 on 2017-6-17.
 */
(function () {
    /**
     * 用于浏览器客户端，进行读取cookie和写cookie
     */
    var cookieUtil = {
        set: function (name, value, expires, path, domain) {
            //encodeURIComponent() 函数可把字符串作为 URI 组件进行编码。
            var cookieText = encodeURIComponent(name) + "=" + encodeURIComponent(value);
            if (expires) {
                cookieText += ";expires=" + expires;
            }
            if (path) {
                cookieText += ";path=" + path;
            }
            if (domain) {
                cookieText += ";domain=" + domain
            }
            document.cookie = cookieText;
        },
        setExt: function (name, value) {
            //创建日期对象
            var date = new Date();
            //获取当前时间戳
            var time = date.getTime();
            var expires = time + 10 * 365 * 24 * 60 * 60 * 1000;
            date.setTime(expires)
            this.set(name, value, date.toGMTString())
        },
        get: function (name) {
            //document.cookie----->uuid=DASDFAS;sid=ASFDASFA;mid=DLKAFA
            var cookieName = encodeURIComponent(name) + "=";
            var cookieValue = null;
            //如果不存在返回-1，否在返回对应的起始位置
            var cookieStart = document.cookie.indexOf(cookieName);
            if (cookieStart > -1) {
                var cookieEnd = document.cookie.indexOf(";", cookieStart);
                if (cookieEnd == -1) {
                    cookieEnd = document.cookie.length
                }
                var value = document.cookie.substring(cookieStart + cookieName.length, cookieEnd);
                cookieValue = decodeURIComponent(value)
            }
            return cookieValue;
        }

    };

    var tracker = {
        /**
         * 客户端配置
         */
        clientConfig: {
            serverUrl: "http://192.168.1.23/log.gif",
            //会话的过期时间
            sessionTimeOut: 6 * 60,
            ver: "1"
        },
        /**
         * 定义发送到日志服务器上的列
         */
        columns: {
            eventName: "en",//事件名称
            version: "ver",//版本号
            platform: "pl",//平台
            sdk: "sdk",//收集方式
            uuid: "uid",//用户的标识
            sessionId: "sid",//会话id
            memberId: "mid",//会员id
            resolution: "b_rst",//浏览器分辨率
            userAgent: "b_usa",//浏览器代理信息
            language: "l",//语言
            clientTime: "ct",//客户端时间
            currentUrl: "url",//当前URL
            referrerUrl: "ref",//上一个页面的URL
            title: "tt"//当前页面的标题
        },
        /**
         * 就是会写入到cookie中的key
         */
        keys: {
            launch: "e_l",//首次访问事件的值
            pageView: "e_pv", // 浏览页面的事件值
            sid: "sid",//会话id
            uuid: "uuid",//用户标识
            mid: "mid",//会员id
            preVisitTime: "previsit",//用户上一次访问的时间
        },
        /**
         * 设置用户的uuid
         * @param uuid
         */
        setUuid: function (uuid) {
            cookieUtil.setExt(this.keys.uuid, uuid)
        },
        /**
         * 获取用户的uuid
         */
        getUuid: function () {
            return cookieUtil.get(this.keys.uuid)
        },
        /**
         * 设置用户会话id
         */
        setSid: function (sid) {
            cookieUtil.setExt(this.keys.sid, sid)
        },
        /**
         * 获取用户会话id
         */
        getSid: function () {
            return cookieUtil.get(this.keys.sid)
        },
        /**
         * 设置会员id
         */
        setMemberId: function (mid) {
            cookieUtil.setExt(this.keys.mid, mid)
        },
        /**
         * 获取会员id
         */
        getMemberId: function () {
            return cookieUtil.get(this.keys.mid)
        },
        sessionStart: function () {
            //判断sessionId是否存在
            if (this.getSid()) {//sessionId存在
                //判断会话是否过期
                if (this.isSessionTimeOut()) {//会话过期
                    //创建新的会话
                    this.createNewSession();
                } else {
                    //更新本次会话最近访问的时间
                    this.updatePreVisitTime()
                }
            } else {
                //创建新的会话
                this.createNewSession();
            }
            //发送pageView事件
            this.onPageView();
        },
        /**
         * 发送pageView事件，用户打开页面时需要发送的事件
         */
        onPageView: function () {
            if (this.preCallApi()) {
                var data = {};
                //事件的名称
                data[this.columns.eventName] = this.keys.pageView;
                //设置公共的列
                this.setCommonColumns(data);
                //设置当前页面的url
                data[this.columns.currentUrl] = window.location.href;
                //前一个页面的url
                data[this.columns.referrerUrl] = document.referrer;
                //设置当前页面的表中
                data[this.columns.title] = document.title;
                //对发送的数据进行转码
                var param = this.parseParam(data);
                //发送数据到日志服务器上
                this.sendDataToServer(param);
                //更新会话最近访问时间
                this.updatePreVisitTime();
            }

        },


        /**
         * 发送launch事件，代表用户首次过来访问，这个事件只会发送一次
         */
        onLaunch: function () {

            var data = {};
            //事件的名称
            data[this.columns.eventName] = this.keys.launch;
            //设置公共的列
            this.setCommonColumns(data);
            //对发送的数据进行转码
            var param = this.parseParam(data);
            //发送数据到日志服务器上
            this.sendDataToServer(param);
            this.updatePreVisitTime();
        },

        /**
         * 在触发非onLaunch事件之前需要进行会话过期判断
         */
        preCallApi: function () {
            if (this.sessionTimeOut) {
                this.sessionStart();
            } else {
                this.updatePreVisitTime();
            }
            return true
        },
        /**
         * 创建新的会话
         */
        createNewSession: function () {
            //生成会话Id
            var sid = this.generateId();
            //将会话id写入到cookie
            this.setSid(sid);
            //判断用户是否是首次访问，如果是首次访问需要创建用户的UUID，并将其写入cookie
            if (!this.getUuid()) {
                var uuid = this.generateId();
                this.setUuid(uuid);
                //发送launch事件，代表用户首次访问
                this.onLaunch();
            }
            //更新用户会话最近访问时间
            this.updatePreVisitTime()
        },

        /**
         * 发送数据到日志服务器上
         * @param param
         */
        sendDataToServer: function (param) {
            var i = new Image(0, 0);
            i.src = this.clientConfig.serverUrl + "?" + param;
        },

        /**
         * 对发送到服务器上的日志进行转码
         */
        parseParam: function (data) {
            var param = "";
            for (key in data) {
                if (key && data[key]) {
                    param += encodeURIComponent(key) + "=" + encodeURIComponent(data[key]) + "&"
                }
            }
            if (param) {
                param = param.substring(0, param.length - 1)
            }
            return param;
        },


        /**
         * 设置事件发送的公共列
         */
        setCommonColumns: function (data) {
            //设置版本号
            data[this.columns.version] = this.clientConfig.ver;

            //发送用户访问所在的平台
            //获取用户代理信息
            var userAgent = window.navigator.userAgent.toLowerCase();
            if (userAgent.indexOf("windows") > 0) {
                data[this.columns.platform] = "pc";
            } else if (userAgent.indexOf("android") > 0) {
                data[this.columns.platform] = "android";
            } else if (userAgent.indexOf("iphone") > 0 || userAgent.indexOf("ipad") > 0) {
                data[this.columns.platform] = "ios";
            } else {
                data[this.columns.platform] = "other";
            }

            //采集的sdk
            data[this.columns.sdk] = "js";
            //用户的uuid
            data[this.columns.uuid] = this.getUuid();
            //用户的会话id
            data[this.columns.sessionId] = this.getSid();
            //用户的会员id
            data[this.columns.memberId] = this.getMemberId();
            //用户设备屏幕分辨率
            data[this.columns.resolution] = screen.width + "*" + screen.height;
            //用户客户端代理信息
            data[this.columns.userAgent] = window.navigator.userAgent;
            //操作系统使用的语言
            data[this.columns.language] = window.navigator.language;
            //客户端访问时间
            data[this.columns.clientTime] = new Date().getTime();
        },
        /**
         * 生成唯一标识符的方法
         */
        generateId: function () {
            var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
            var uuid = [], i;
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
            return uuid.join('');
        },
        /**
         * 更新会话最近访问时间
         */
        updatePreVisitTime: function () {
            var currentTime = new Date().getTime();
            cookieUtil.setExt(this.keys.preVisitTime, currentTime);
        },

        /**
         * 判断会话是否过期
         */
        isSessionTimeOut: function () {
            //获取会话最近一次访问时间
            var preVisitTime = cookieUtil.get(this.keys.preVisitTime)
            //获取当前客户端时间
            var currentTime = new Date().getTime()
            return currentTime - preVisitTime > this.clientConfig.sessionTimeOut * 1000
        }
    };

    /**
     * 将事件暴露出去
     */
    window.__AE__ = {
        /**
         * 自动触发的事件，不需要你手动编写脚本调用
         */
        sessionStart: function () {
            tracker.sessionStart();
        }
    }
    /**
     * 自动加载事件的方法
     */
    var autoLoad = function () {
        __AE__.sessionStart();
    }
    autoLoad();
})();
