// ==UserScript==
// @name         bilibili
// @namespace    https://github.com/injahow
// @version      1.8.7
// @description 
// @author       injahow
// @source       https://github.com/injahow/bilibili-parse
// @copyright    2021, injahow (https://github.com/injahow)
// @include      *://www.bilibili.com/video/av*
// @include      *://www.bilibili.com/video/BV*
// @include      *://www.bilibili.com/medialist/play/*
// @include      *://www.bilibili.com/bangumi/play/ep*
// @include      *://www.bilibili.com/bangumi/play/ss*
// @include      *://www.bilibili.com/cheese/play/ep*
// @include      *://www.bilibili.com/cheese/play/ss*
// @include      https://www.mcbbs.net/template/mcbbs/image/special_photo_bg.png*
// @require      https://static.hdslb.com/js/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/flv.js/1.6.2/flv.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/dplayer/1.26.0/DPlayer.min.js
// @compatible   chrome
// @compatible   firefox
// @license      MIT
// @grant        none
// ==/UserScript==
/* globals $, DPlayer waitForKeyElements */
(function () {
    'use strict';

    if (window.bp_fun_locked) return;
    window.bp_fun_locked = true;

    // user
    let UserStatus;
    (function () {
        UserStatus = {
            lazy_init,
            is_login, vip_status, mid, uname,
            need_replace
        };
        let _is_login = false, _vip_status = 0, _mid = '', _uname = '';
        let is_init = false;

        function lazy_init(last_init = false) {
            if (!is_init) {
                if (window.__BILI_USER_INFO__) {
                    _is_login = window.__BILI_USER_INFO__.isLogin;
                    _vip_status = window.__BILI_USER_INFO__.vipStatus;
                    _mid = window.__BILI_USER_INFO__.mid || '';
                    _uname = window.__BILI_USER_INFO__.uname || '';
                } else if (window.__BiliUser__) {
                    _is_login = window.__BiliUser__.isLogin;
                    if (window.__BiliUser__.cache) {
                        _vip_status = window.__BiliUser__.cache.data.vipStatus;
                        _mid = window.__BiliUser__.cache.data.mid || '';
                        _uname = window.__BiliUser__.cache.data.uname || '';
                    } else {
                        _vip_status = 0;
                        _mid = '';
                        _uname = '';
                    }
                } else {
                    _is_login = false;
                    _vip_status = 0;
                    _mid = '';
                    _uname = '';
                }
                is_init = last_init;
            }
        }

        function is_login() {
            return _is_login;
        }

        function vip_status() {
            return _vip_status;
        }

        function mid() {
            return _mid;
        }

        function uname() {
            return _uname;
        }

        function need_replace() {
            return (!_is_login || (_is_login && !_vip_status && VideoStatus.base().need_vip()));
        }

    })();

    // auth
    let Auth;
    (function () {
        // https://greasyfork.org/zh-CN/scripts/25718-%E8%A7%A3%E9%99%A4b%E7%AB%99%E5%8C%BA%E5%9F%9F%E9%99%90%E5%88%B6/code
        if (location.href.match(/^https:\/\/www\.mcbbs\.net\/template\/mcbbs\/image\/special_photo_bg\.png/) != null) {
            if (location.href.match('access_key') && window !== window.parent) {
                window.stop();
                window.parent.postMessage('bilibili-parse-login-credentials: ' + location.href, '*');
            }
            Auth = null;
            return;
        }

        Auth = {
            check_login_status
        };

        let auth_clicked = false;

        function check_login_status() {
            !localStorage.getItem('bp_remind_login') && localStorage.setItem('bp_remind_login', '1');
            const [auth_id, auth_sec, access_key, auth_time] = [
                localStorage.getItem('bp_auth_id') || '',
                localStorage.getItem('bp_auth_sec') || '',
                localStorage.getItem('bp_access_key') || '',
                localStorage.getItem('bp_auth_time') || '0'
            ];
            if (access_key && auth_time === '0') {
                localStorage.setItem('bp_auth_time', Date.now());
            }
            if (UserStatus.is_login()) {
                if (localStorage.getItem('bp_remind_login') === '1') {
                    if (!access_key) {
                        utils.MessageBox.confirm('????????????????????????????????????????????????1080P???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????', () => {
                            window.bp_show_login();
                        });
                    }
                    localStorage.setItem('bp_remind_login', '0');
                } else if (config.base_api !== localStorage.getItem('bp_pre_base_api') || (Date.now() - parseInt(auth_time) > 24 * 60 * 60 * 1000)) {
                    // check key
                    if (access_key) {
                        $.ajax(`https://api.bilibili.com/x/space/myinfo?access_key=${access_key}`, {
                            type: 'GET',
                            dataType: 'json',
                            success: (res) => {
                                if (res.code) {
                                    utils.MessageBox.alert('????????????????????????????????????', () => {
                                        localStorage.setItem('bp_access_key', '');
                                        localStorage.setItem('bp_auth_time', '0');
                                        window.bp_show_login();
                                    });
                                } else {
                                    localStorage.setItem('bp_auth_time', Date.now());
                                    $.ajax(`${config.base_api}/auth/v2/?act=check&auth_id=${auth_id}&auth_sec=${auth_sec}&access_key=${access_key}`, {
                                        type: 'GET',
                                        dataType: 'json',
                                        success: (res) => {
                                            if (res.code) {
                                                utils.Message.warning('?????????????????????' + res.message);
                                            }
                                        },
                                        error: () => {
                                            utils.Message.danger('??????????????????');
                                        }
                                    });
                                }
                            },
                            error: () => {
                                utils.Message.danger('??????key????????????');
                            }
                        });
                    }
                }
            }
            localStorage.setItem('bp_pre_base_api', config.base_api);
        }

        window.bp_show_login = function (auto = '1') {
            if (auth_clicked) {
                utils.Message.info('(^????????^)~?????????~');
                return;
            }
            auth_clicked = true;
            if (localStorage.getItem('bp_access_key')) {
                utils.MessageBox.confirm('??????????????????????????????????????????', () => {
                    if (auto === '1') {
                        login();
                    } else {
                        login_manual();
                    }
                }, () => {
                    auth_clicked = false;
                });
            } else {
                if (auto === '1') {
                    login();
                } else {
                    login_manual();
                }
            }
        }

        function login() {
            $.ajax('https://passport.bilibili.com/login/app/third?appkey=27eb53fc9058f8c3&api=https%3A%2F%2Fwww.mcbbs.net%2Ftemplate%2Fmcbbs%2Fimage%2Fspecial_photo_bg.png&sign=04224646d1fea004e79606d3b038c84a', {
                xhrFields: { withCredentials: true },
                type: 'GET',
                dataType: 'json',
                success: (res) => {
                    if (res.data.has_login) {
                        $('body').append(`<iframe id="auth_iframe" src="${res.data.confirm_uri}" style="display:none"></iframe>`);
                    } else {
                        utils.MessageBox.confirm('????????????B???????????????????????????????????????', () => {
                            location.href = 'https://passport.bilibili.com/login';
                        }, () => {
                            auth_clicked = false;
                        });
                    }
                },
                error: () => {
                    utils.Message.danger('??????????????????');
                    auth_clicked = false;
                }
            });
        }

        function login_manual() {
            $.ajax('https://passport.bilibili.com/login/app/third?appkey=27eb53fc9058f8c3&api=https%3A%2F%2Fwww.mcbbs.net%2Ftemplate%2Fmcbbs%2Fimage%2Fspecial_photo_bg.png&sign=04224646d1fea004e79606d3b038c84a', {
                xhrFields: { withCredentials: true },
                type: 'GET',
                dataType: 'json',
                success: (res) => {
                    if (res.data.has_login) {
                        const msg = '' +
                            `?????????<b><a href="${res.data.confirm_uri}" target="_blank">????????????</a></b>???????????????????????????????????????????????????????????????????????????????????????????????????URL?????????????????????????????????<br/>
                            <input id="auth_url" style="width:100%" type="text" autocomplete="off"><br>
                            ????????????????????????`;
                        utils.MessageBox.alert(msg, () => {
                            const auth_url = $('#auth_url').val();
                            const [auth_id, auth_sec] = [
                                localStorage.getItem('bp_auth_id') || '',
                                localStorage.getItem('bp_auth_sec') || ''
                            ];
                            $.ajax(auth_url.replace('https://www.mcbbs.net/template/mcbbs/image/special_photo_bg.png?', `${config.base_api}/auth/v2/?act=login&auth_id=${auth_id}&auth_sec=${auth_sec}&`), {
                                type: 'GET',
                                dataType: 'json',
                                success: (res) => {
                                    if (!res.code) {
                                        utils.Message.success('????????????');
                                        if (res.auth_id && res.auth_sec) {
                                            localStorage.setItem('bp_auth_id', res.auth_id);
                                            localStorage.setItem('bp_auth_sec', res.auth_sec);
                                        }
                                        localStorage.setItem('bp_access_key', new URL(auth_url).searchParams.get('access_key'));
                                        localStorage.setItem('bp_auth_time', Date.now());
                                        $('#auth').val('1');
                                        config.auth = '1';
                                    } else {
                                        utils.Message.warning('????????????');
                                    }
                                    auth_clicked = false;
                                },
                                error: () => {
                                    utils.Message.danger('????????????');
                                    auth_clicked = false;
                                }
                            });
                        });
                    } else {
                        utils.MessageBox.confirm('????????????B???????????????????????????????????????', () => {
                            location.href = 'https://passport.bilibili.com/login';
                        }, () => {
                            auth_clicked = false;
                        });
                    }
                },
                error: () => {
                    utils.Message.danger('??????????????????');
                    auth_clicked = false;
                }
            });
        }

        window.bp_show_logout = function () {
            const [auth_id, auth_sec] = [
                localStorage.getItem('bp_auth_id') || '',
                localStorage.getItem('bp_auth_sec') || ''
            ];
            if (auth_clicked) {
                utils.Message.info('(^????????^)~?????????~');
                return;
            }
            auth_clicked = true;
            if (!auth_id) {
                utils.MessageBox.alert('????????????????????????');
                auth_clicked = false;
                return;
            }
            $.ajax(`${config.base_api}/auth/v2/?act=logout&auth_id=${auth_id}&auth_sec=${auth_sec}`, {
                type: 'GET',
                dataType: 'json',
                success: (res) => {
                    if (!res.code) {
                        utils.Message.success('????????????');
                        localStorage.setItem('bp_auth_id', '');
                        localStorage.setItem('bp_auth_sec', '');
                        localStorage.setItem('bp_auth_time', '');
                        localStorage.setItem('bp_access_key', '');
                        $('#auth').val('0');
                        config.auth = '0';
                    } else {
                        utils.Message.warning('????????????');
                    }
                    auth_clicked = false;
                },
                error: () => {
                    utils.Message.danger('????????????');
                    auth_clicked = false;
                }
            });
        }
        window.bp_show_login_help = function () {
            utils.MessageBox.confirm('????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????', () => {
                window.bp_show_login();
            });
        }
        window.addEventListener('message', function (e) {
            if (typeof e.data !== 'string') return;
            if (e.data.split(':')[0] === 'bilibili-parse-login-credentials') {
                $('iframe#auth_iframe').remove();
                let url = e.data.split(': ')[1];
                const [auth_id, auth_sec] = [
                    localStorage.getItem('bp_auth_id') || '',
                    localStorage.getItem('bp_auth_sec') || ''
                ];
                $.ajax(url.replace('https://www.mcbbs.net/template/mcbbs/image/special_photo_bg.png?', `${config.base_api}/auth/v2/?act=login&auth_id=${auth_id}&auth_sec=${auth_sec}&`), {
                    type: 'GET',
                    dataType: 'json',
                    success: (res) => {
                        if (!res.code) {
                            utils.Message.success('????????????');
                            if (res.auth_id && res.auth_sec) {
                                localStorage.setItem('bp_auth_id', res.auth_id);
                                localStorage.setItem('bp_auth_sec', res.auth_sec);
                            }
                            localStorage.setItem('bp_access_key', new URL(url).searchParams.get('access_key'));
                            localStorage.setItem('bp_auth_time', Date.now());
                            $('#auth').val('1');
                            config.auth = '1';
                        } else {
                            utils.Message.warning('????????????');
                        }
                        auth_clicked = false;
                    },
                    error: () => {
                        utils.Message.danger('????????????');
                        auth_clicked = false;
                    }
                });
            }
        });
    })();
    if (!Auth) {
        return;
    }

    // config
    const config = {
        base_api: 'https://api.injahow.cn/bparse/',
        format: 'flv',
        host_key: '0',
        replace_force: '0',
        auth: '0',
        download_type: 'web',
        rpc_domain: 'http://localhost',
        rpc_port: '16800',
        rpc_token: '',
        rpc_dir: 'D:/',
        auto_download: '0'
    };
    const hostMap = {
        ks3: 'upos-sz-mirrorks3.bilivideo.com',
        ks3b: 'upos-sz-mirrorks3b.bilivideo.com',
        ks3c: 'upos-sz-mirrorks3c.bilivideo.com',
        ks32: 'upos-sz-mirrorks32.bilivideo.com',
        kodo: 'upos-sz-mirrorkodo.bilivideo.com',
        kodob: 'upos-sz-mirrorkodob.bilivideo.com',
        cos: 'upos-sz-mirrorcos.bilivideo.com',
        cosb: 'upos-sz-mirrorcosb.bilivideo.com',
        bos: 'upos-sz-mirrorbos.bilivideo.com',
        wcs: 'upos-sz-mirrorwcs.bilivideo.com',
        wcsb: 'upos-sz-mirrorwcsb.bilivideo.com',
        /* ??????CROS, ??????UA */
        hw: 'upos-sz-mirrorhw.bilivideo.com',
        hwb: 'upos-sz-mirrorhwb.bilivideo.com',
        upbda2: 'upos-sz-upcdnbda2.bilivideo.com',
        upws: 'upos-sz-upcdnws.bilivideo.com',
        uptx: 'upos-sz-upcdntx.bilivideo.com',
        uphw: 'upos-sz-upcdnhw.bilivideo.com',
        js: 'upos-tf-all-js.bilivideo.com',
        hk: 'cn-hk-eq-bcache-01.bilivideo.com',
        akamai: 'upos-hz-mirrorakam.akamaized.net'
    };
    // config_init
    (function () {
        const default_config = Object.assign({}, config); // ?????????
        const config_str = localStorage.getItem('my_config_str');
        if (!config_str) {
            localStorage.setItem('my_config_str', JSON.stringify(config));
        } else {
            // set config from cache
            const old_config = JSON.parse(config_str);
            for (const key in old_config) {
                if (Object.hasOwnProperty.call(config, key)) {
                    config[key] = old_config[key];
                }
            }
        }
        window.bp_save_config = () => {
            // set config by form
            for (const key in config) {
                config[key] = $(`#${key}`).val();
            }
            const old_config = JSON.parse(localStorage.getItem('my_config_str'));
            localStorage.setItem('my_config_str', JSON.stringify(config));
            $('#my_config').hide();
            utils.Scroll.show();
            // ??????????????????????????????
            for (const key of ['base_api', 'format', 'auth']) {
                if (config[key] !== old_config[key]) {
                    $('#video_download').hide();
                    $('#video_download_2').hide();
                    break;
                }
            }
            if (config.host_key !== old_config.host_key) {
                Check.refresh();
                $('#video_url').attr('href', '#');
                $('#video_url_2').attr('href', '#');
            }
            // ??????RPC????????????
            if (config.rpc_domain !== old_config.rpc_domain) {
                if (!(config.rpc_domain.match('https://') || config.rpc_domain.match(/(localhost|127\.0\.0\.1)/))) {
                    utils.MessageBox.alert('' +
                        '???????????????RPC???????????????http????????????????????????AriaNG????????????????????????' +
                        '??????????????????RPC????????????????????????????????????????????????????????????????????????' +
                        '????????????????????????????????????????????????<br/>??????????????????????????????????????????', () => {
                            utils.open_ariang();
                        });
                }
            }
        };

        window.onbeforeunload = () => {
            window.bp_save_config();
            const bp_aria2_window = window.bp_aria2_window;
            if (bp_aria2_window && !bp_aria2_window.closed) {
                bp_aria2_window.close();
            }
        };

        let help_clicked = false;
        window.bp_show_help = () => {
            if (help_clicked) {
                utils.Message.info('(^????????^)~?????????~');
                return;
            }
            help_clicked = true;
            $.ajax(`${config.base_api}/auth/v2/?act=help`, {
                dataType: 'text',
                success: (result) => {
                    if (result) {
                        utils.MessageBox.alert(result);
                    } else {
                        utils.Message.warning('????????????');
                    }
                    help_clicked = false;
                },
                error: (e) => {
                    utils.Message.danger('????????????');
                    help_clicked = false;
                    console.log('error', e);
                }
            });
        };
        !window.bp_reset_config && (window.bp_reset_config = () => {
            for (const key in default_config) {
                if (key === 'auth') {
                    continue;
                }
                $(`#${key}`).val(default_config[key]);
            }
        });

        const host_keys = Object.keys(hostMap);
        let host_key_option = '<option value="0">??????</option>';
        for (const key of host_keys) {
            host_key_option += `<option value="${key}">${hostMap[key]}</option>`;
        }
        const config_css = '' +
            '<style>' +
            '@keyframes settings-bg{from{background:rgba(0,0,0,0)}to{background:rgba(0,0,0,.7)}}' +
            '.setting-button{width:120px;height:40px;border-width:0px;border-radius:3px;background:#1E90FF;cursor:pointer;outline:none;color:white;font-size:17px;}.setting-button:hover{background:#5599FF;}' +
            'a.setting-context{margin:0 2%;color:blue;}a.setting-context:hover{color:red;}' +
            '</style>';
        const config_html = '' +
            `<div id="my_config"
                style="display:none;position:fixed;inset:0px;top:0px;left:0px;width:100%;height:100%;background:rgba(0,0,0,0.7);animation-name:settings-bg;animation-duration:0.3s;z-index:10000;cursor:default;">
                <div
                    style="position:absolute;background:rgb(255,255,255);border-radius:10px;padding:20px;top:50%;left:50%;width:600px;transform:translate(-50%,-50%);cursor:default;">
                    <span style="font-size:20px">
                        <b>bilibili???????????? ????????????</b>
                        <b>
                            <a href="javascript:;" onclick="bp_reset_config()"> [????????????] </a>
                            <a style="text-decoration:underline;" href="javascript:;" onclick="bp_show_help()">&lt;??????&??????&gt;</a>
                        </b>
                    </span>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <input id="base_api" value="..." style="width:50%;"><br />
                        <small>????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <select name="format" id="format">
                            <option value="flv">FLV</option>
                            <option value="dash">DASH</option>
                            <option value="mp4">MP4</option>
                        </select>&nbsp;&nbsp;&nbsp;&nbsp;
                        <label>??????CDN???</label>
                        <select name="host_key" id="host_key">
                            ${host_key_option}
                        </select><br />
                        <small>????????????video??????MP4?????????????????????????????????????????????CDN??????????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <select name="download_type" id="download_type">
                            <option value="a">URL??????</option>
                            <option value="web">Web?????????</option>
                            <option value="blob">Blob??????</option>
                            <option value="rpc">RPC??????</option>
                            <option value="aria">Aria??????</option>
                        </select><br />
                        <small>?????????url???web?????????????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>RPC?????????[ ?????? : ?????? | ?????? | ???????????? ]</label><br />
                        <input id="rpc_domain" value="..." style="width:25%;"> :
                        <input id="rpc_port" value="..." style="width:10%;"> |
                        <input id="rpc_token" placeholder="?????????????????????" value="..." style="width:15%;"> |
                        <input id="rpc_dir" placeholder="????????????????????????" value="..." style="width:20%;"><br />
                        <small>?????????RPC????????????Motrix???????????????????????????????????????????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <select name="replace_force" id="replace_force">
                            <option value="0">??????</option>
                            <option value="1">??????</option>
                        </select><br />
                        <small>??????????????????????????????????????????????????????????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <select name="auto_download" id="auto_download">
                            <option value="0">??????</option>
                            <option value="1">??????</option>
                        </select><br />
                        <small>???????????????????????????????????????????????????????????????</small>
                    </div>
                    <div style="margin:2% 0;"><label>???????????????</label>
                        <select name="auth" id="auth" disabled>
                            <option value="0">?????????</option>
                            <option value="1">?????????</option>
                        </select>
                        <a class="setting-context" href="javascript:;" onclick="bp_show_login()">????????????</a>
                        <a class="setting-context" href="javascript:;" onclick="bp_show_logout()">????????????</a>
                        <a class="setting-context" href="javascript:;" onclick="bp_show_login('0')">????????????</a>
                        <a class="setting-context" href="javascript:;" onclick="bp_show_login_help()">???????????????</a>
                    </div>
                    <div style="text-align:right"><br />
                        <button class="setting-button" onclick="bp_save_config()">??????</button>
                    </div>
                </div>
            </div>`;
        $('body').append(config_html + config_css);
        // ?????????????????????
        for (const key in config) {
            $(`#${key}`).val(config[key]);
        }
    })();

    // components
    const utils = {
        Video: {},
        Player: {},
        Message: {},
        MessageBox: {},
        Scroll: {}
    };
    // components_init
    (function () {

        utils.open_ariang = open_ariang;

        // Video
        utils.Video = {
            download: (url, name, type) => {
                const filename = name.replace(/[\/\\:*?"<>|]+/g, '');
                if (type === 'blob') {
                    download_blob(url, filename);
                } else if (type === 'rpc') {
                    download_rpc(url, filename, rpc_type());
                }
            },
            download_all,
            download_danmaku_ass,
            download_subtitle_vtt
        };

        function rpc_type() {
            if (config.rpc_domain.match('https://') || config.rpc_domain.match(/localhost|127\.0\.0\.1/)) {
                return 'post';
            } else {
                return 'ariang';
            }
        }

        function download_all() {

            const [auth_id, auth_sec] = [
                localStorage.getItem('bp_auth_id'),
                localStorage.getItem('bp_auth_sec')
            ];
            const video_base = VideoStatus.base();
            const [type, q, total] = [
                video_base.type,
                VideoStatus.get_quality().q,
                video_base.total()
            ];

            $('body').on('click', 'input[name="dl_video"]', function () {
                if ($(this).is(':checked')) {
                    $(this).parent().css('color', 'rgba(0,0,0,1)');
                } else {
                    $(this).parent().css('color', 'rgba(0,0,0,0.5)');
                }
            });
            let video_html = '';
            for (let i = 0; i < total; i++) {
                video_html += '' +
                    `<label for="option_${i}"><div style="color:rgba(0,0,0,0.5);">
                        <input type="checkbox" id="option_${i}" name="dl_video" value="${i}">
                        P${i + 1} ${video_base.title(i + 1)}
                    </div></label>`;
            }

            let all_checked = false;
            $('body').on('click', 'button#checkbox_btn', function () {
                if (all_checked) {
                    all_checked = false;
                    $('input[name="dl_video"]').prop('checked', all_checked);
                    $('input[name="dl_video"]').parent().css('color', 'rgba(0,0,0,0.5)');
                } else {
                    all_checked = true;
                    $('input[name="dl_video"]').prop('checked', all_checked);
                    $('input[name="dl_video"]').parent().css('color', 'rgb(0,0,0)');
                }
            });

            const q_map = {
                '127': '8K',
                '120': '4K ??????',
                '116': '1080P 60???',
                '112': '1080P ?????????',
                '80': '1080P ??????',
                '74': '720P 60???',
                '64': '720P ??????',
                '48': '720P ??????(MP4)',
                '32': '480P ??????',
                '16': '360P ??????'
            };
            const quality_support = VideoStatus.get_quality_support();
            let option_support_html = '';
            for (const item of quality_support) {
                option_support_html += `<option value="${item}">${q_map[item]}</option>`;
            }
            const msg = '' +
                `<div style="margin:2% 0;">
                    <label>???????????????</label>
                    <select name="dl_format" id="dl_format">
                        <option value="flv" selected>FLV</option>
                        <option value="mp4">MP4</option>
                    </select>
                    &nbsp;&nbsp;???video????????????mp4
                </div>
                <div style="margin:2% 0;">
                    <label>???????????????</label>
                    <select name="dl_quality" id="dl_quality">
                        ${option_support_html}
                    </select>
                </div>
                <div style="margin:2% 0;">
                    <label>???????????????</label>
                    <select name="dl_subtitle" id="dl_subtitle">
                        <option value="0" selected>??????</option>
                        <option value="1">VTT</option>
                    </select>
                    &nbsp;&nbsp;
                    <label>???????????????</label>
                    <select name="dl_danmaku" id="dl_danmaku">
                        <option value="0" selected>??????</option>
                        <option value="1">ASS</option>
                    </select>
                </div>
                <b>
                    <span style="color:red;">????????????????????????????????????????????????????????????????????????????????????</span>
                </b><br />
                <div style="height:220px;width:100%;overflow:auto;background:rgba(0,0,0,0.1);">
                    ${video_html}
                </div>
                <div>${VideoStatus.type() === 'medialist' ? '??????????????????????????????????????????????????????????????????' : ''}</div>
                <div style="margin:2% 0;">
                    <button id="checkbox_btn">??????</button>
                </div>`;

            utils.MessageBox.confirm(msg, () => {
                // ????????????
                let _q = $('#dl_quality').val() || q;
                let _dl_subtitle = $('#dl_subtitle').val();
                let _dl_danmaku = $('#dl_danmaku').val();

                const videos = [];
                for (let i = 0; i < total; i++) {
                    if (!$(`input#option_${i}`).is(':checked')) {
                        continue;
                    }
                    const p = i + 1;
                    const [aid, cid, epid, filename] = [
                        video_base.aid(p),
                        video_base.cid(p),
                        video_base.epid(p),
                        video_base.filename(p)
                    ];
                    const format = $('#dl_format').val();
                    videos.push({
                        dl_subtitle: _dl_subtitle,
                        dl_danmaku: _dl_danmaku,
                        cid: cid,
                        p: p,
                        url: `${config.base_api}?av=${aid}&p=${p}&cid=${cid}&ep=${epid}&q=${_q}&type=${type}&format=${format}&otype=json&auth_id=${auth_id}&auth_sec=${auth_sec}&s`,
                        filename: filename
                    });
                }
                get_url(videos, 0, []);
            });
            // ???????????????
            $('#dl_quality').val(q);

            function get_url(videos, i, video_urls) {
                // ?????????????????????????????????????????????
                if (videos.length) {
                    if (i < videos.length) {
                        const video = videos[i];
                        if (video.dl_subtitle === '1') {
                            // ????????????vtt
                            utils.Video.download_subtitle_vtt(video.p, video.filename)
                        }
                        if (video.dl_danmaku === '1') {
                            // ????????????ass
                            utils.Video.download_danmaku_ass(video.cid, video.filename);
                        }
                        const msg = `???${i + 1}???${i + 1}/${videos.length}????????????`;
                        utils.MessageBox.alert(`${msg}????????????...`);
                        setTimeout(function () {
                            $.ajax(video.url, {
                                type: 'GET',
                                dataType: 'json',
                                success: (res) => {
                                    if (!res.code) {
                                        utils.Message.success('????????????' + (res.times ? `<br/>????????????????????????${res.times}` : ''));
                                        utils.MessageBox.alert(`${msg}??????????????????`);
                                        let url = res.url;

                                        let video_format = '';
                                        if (url.match('.flv')) {
                                            video_format = '.flv';
                                        } else if (url.match('.mp4')) {
                                            video_format = '.mp4';
                                        }

                                        if (config.host_key !== '0') {
                                            // ????????????CDN??????
                                            let url_tmp = url.split('/');
                                            url_tmp[2] = hostMap[config.host_key];
                                            url = url_tmp.join('/');
                                        }

                                        const type = rpc_type();
                                        if (type === 'post') {
                                            video_urls.push({
                                                url: url,
                                                filename: video.filename + video_format
                                            });
                                            if (video_urls.length > 3) {
                                                download_rpc_all(video_urls)
                                                video_urls.length = 0;
                                            }
                                        } else if (type === 'ariang') {
                                            download_rpc_ariang_one({
                                                url: url,
                                                filename: video.filename + video_format
                                            });
                                        }
                                    } else {
                                        utils.Message.warning(`???${i + 1}????????????????????????` + res.message);
                                    }
                                    setTimeout(function () {
                                        get_url(videos, ++i, video_urls);
                                    }, 1000);
                                },
                                error: () => {
                                    utils.Message.danger(`???${i + 1}?????????????????????`);
                                    get_url(videos, ++i, video_urls);
                                }
                            });
                        }, 2000);
                    } else {
                        utils.MessageBox.alert('???????????????????????????');
                        if (rpc_type() === 'post') {
                            if (video_urls.length > 0) {
                                download_rpc_all(video_urls);
                                video_urls.length = 0;
                            }
                        }
                        // one by one -> null
                    }
                }
            }

            function download_rpc_all(video_urls) {
                const rpc = {
                    domain: config.rpc_domain,
                    port: config.rpc_port,
                    token: config.rpc_token,
                    dir: config.rpc_dir
                };
                const json_rpc = [];
                for (const video of video_urls) {
                    json_rpc.push({
                        id: window.btoa(`BParse_${Date.now()}_${Math.random()}`),
                        jsonrpc: '2.0',
                        method: 'aria2.addUri',
                        params: [`token:${rpc.token}`, [video.url], {
                            dir: rpc.dir,
                            out: video.filename,
                            header: [
                                `User-Agent: ${window.navigator.userAgent}`,
                                `Referer: ${window.location.href}`
                            ]
                        }]
                    });
                }
                utils.Message.info('??????RPC????????????');
                $.ajax(`${rpc.domain}:${rpc.port}/jsonrpc`, {
                    type: 'POST',
                    dataType: 'json',
                    data: JSON.stringify(json_rpc),
                    success: (res) => {
                        if (res.length === json_rpc.length) {
                            utils.Message.success('RPC????????????');
                        } else {
                            utils.Message.warning('RPC????????????');
                        }
                    },
                    error: () => {
                        utils.Message.danger('RPC????????????????????????RPC?????????????????????????????????');
                    }
                });
            }
        }

        function download_rpc_ariang_one(video) {
            const bp_aria2_window = window.bp_aria2_window;
            let time = 100;
            if (!bp_aria2_window || bp_aria2_window.closed) {
                open_ariang();
                time = 3000;
            }
            setTimeout(() => {
                const bp_aria2_window = window.bp_aria2_window;
                const aria2_header = `header=User-Agent:${window.navigator.userAgent}&header=Referer:${window.location.href}`;
                if (bp_aria2_window && !bp_aria2_window.closed) {
                    const task_hash = `#!/new/task?url=${window.btoa(video.url)}&out=${encodeURIComponent(video.filename)}&${aria2_header}`;
                    bp_aria2_window.location.href = `http://ariang.injahow.com/${task_hash}`;
                    utils.Message.success('RPC????????????');
                } else {
                    utils.Message.warning('RPC????????????');
                }
            }, time);
        }

        let download_rpc_clicked = false;

        function download_rpc(url, filename, type = 'post') {
            if (download_rpc_clicked) {
                utils.Message.info('(^????????^)~?????????~');
                return;
            }
            download_rpc_clicked = true;
            const rpc = {
                domain: config.rpc_domain,
                port: config.rpc_port,
                token: config.rpc_token,
                dir: config.rpc_dir
            };
            const json_rpc = {
                id: window.btoa(`BParse_${Date.now()}_${Math.random()}`),
                jsonrpc: '2.0',
                method: 'aria2.addUri',
                params: [`token:${rpc.token}`, [url], {
                    dir: rpc.dir,
                    out: filename,
                    header: [
                        `User-Agent: ${window.navigator.userAgent}`,
                        `Referer: ${window.location.href}`
                    ]
                }]
            };
            utils.Message.info('??????RPC????????????');
            if (type === 'post') {
                $.ajax(`${rpc.domain}:${rpc.port}/jsonrpc`, {
                    type: 'POST',
                    dataType: 'json',
                    data: JSON.stringify(json_rpc),
                    success: (res) => {
                        if (res.result) {
                            utils.Message.success('RPC????????????');
                        } else {
                            utils.Message.warning('RPC????????????');
                        }
                        download_rpc_clicked = false;
                    },
                    error: () => {
                        utils.Message.danger('RPC????????????????????????RPC?????????????????????????????????');
                        download_rpc_clicked = false;
                    }
                });
            } else if (type === 'ariang') {
                const bp_aria2_window = window.bp_aria2_window;
                let time = 100;
                if (!bp_aria2_window || bp_aria2_window.closed) {
                    open_ariang();
                    time = 3000;
                }
                setTimeout(() => {
                    const bp_aria2_window = window.bp_aria2_window;
                    const aria2_header = `header=User-Agent:${window.navigator.userAgent}&header=Referer:${window.location.href}`;
                    const task_hash = `#!/new/task?url=${window.btoa(url)}&out=${encodeURIComponent(filename)}&${aria2_header}`;
                    if (bp_aria2_window && !bp_aria2_window.closed) {
                        bp_aria2_window.location.href = `http://ariang.injahow.com/${task_hash}`;
                        utils.Message.success('RPC????????????');
                    } else {
                        utils.Message.warning('RPC????????????');
                    }
                    download_rpc_clicked = false;
                }, time);
            }
        }

        function open_ariang() {
            const a = document.createElement('a');
            const rpc = {
                domain: config.rpc_domain,
                port: config.rpc_port,
                token: config.rpc_token
            };
            const url = `http://ariang.injahow.com/#!/settings/rpc/set/${rpc.domain.replace('://', '/')}/${rpc.port}/jsonrpc/${window.btoa(rpc.token)}`;
            a.setAttribute('target', '_blank');
            a.setAttribute('onclick', `window.bp_aria2_window=window.open('${url}');`);
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        let download_blob_clicked = false, need_show_progress = true;

        function show_progress({ total, loaded, percent }) {
            if (need_show_progress) {
                utils.MessageBox.alert(`???????????????${Math.floor(total / (1024 * 1024))}MB(${total}Byte)<br/>` +
                    `???????????????${Math.floor(loaded / (1024 * 1024))}MB(${loaded}Byte)<br/>` +
                    `???????????????${percent}%<br/>?????????????????????????????????`, () => {
                        need_show_progress = false;
                        utils.MessageBox.alert('??????????????????????????????????????????????????????<br/>????????????????????????????????????????????????');
                    });
            }
            if (total === loaded) {
                utils.MessageBox.alert('??????????????????????????????????????????');
                download_blob_clicked = false;
            }
        }

        function download_blob(url, filename) {
            if (download_blob_clicked) {
                utils.Message.info('(^????????^)~?????????~');
                need_show_progress = true;
                return;
            }
            const xhr = new XMLHttpRequest();
            xhr.open('get', url);
            xhr.responseType = 'blob';
            xhr.onload = function () {
                if (this.status === 200 || this.status === 304) {
                    if ('msSaveOrOpenBlob' in navigator) {
                        navigator.msSaveOrOpenBlob(this.response, filename);
                        return;
                    }
                    const blob_url = URL.createObjectURL(this.response);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = blob_url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(blob_url);
                }
            };
            need_show_progress = true;
            xhr.onprogress = function (evt) {
                if (this.state != 4) {
                    const loaded = evt.loaded;
                    const tot = evt.total;
                    show_progress({
                        total: tot,
                        loaded: loaded,
                        percent: Math.floor(100 * loaded / tot)
                    });
                }
            };
            xhr.send();
            download_blob_clicked = true; // locked
            utils.Message.info('??????????????????');
        }

        function download_danmaku_ass(_cid, title) { // ?????????...
            $.ajax(`https://api.bilibili.com/x/v1/dm/list.so?oid=${_cid}`, {
                dataType: 'text',
                success: (result) => {
                    const result_dom = $(result.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, ''));
                    if (!result_dom || !result_dom.find('d')[0]) {
                        utils.Message.warning('???????????????');
                        return;
                    } else {
                        // 1.json
                        const danmaku_data = result_dom.find('d').map((i, el) => {
                            const item = $(el);
                            const p = item.attr('p').split(',');
                            let type = 0;
                            if (p[1] === '4') {
                                type = 2;
                            } else if (p[1] === '5') {
                                type = 1;
                            }
                            return [{ time: parseFloat(p[0]), type: type, color: parseInt(p[3]), text: item.text() }];
                        }).get();
                        danmaku_data.sort((a, b) => a.time - b.time);
                        // 2.dialogue
                        const dialogue = (danmaku, scroll_id, fix_id) => {
                            const encode = text => text.replace(/\{/g, '???').replace(/\}/g, '???').replace(/\r|\n/g, '');
                            const colorCommand = color => {
                                const [r, g, b] = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
                                return `\\c&H${((b << 16) | (g << 8) | r).toString(16)}&`;
                            };
                            //const borderColorCommand = color => `\\3c&H${color.toString(16)}&`;
                            const isWhite = color => color === 16777215;
                            const scrollCommand = (top, left_a, left_b) => `\\move(${left_a},${top},${left_b},${top})`;
                            const fixCommand = (top, left) => `\\pos(${left},${top})`;
                            const [scrollTime, fixTime] = [8, 4];
                            const { text, time } = danmaku;
                            const commands = [
                                danmaku.type === 0 ? scrollCommand(50 * (1 + Math.floor(Math.random() * 15)), 1920 + 50 * danmaku.text.length / 2, 0 - 50 * danmaku.text.length / 2) : fixCommand(50 * (1 + fix_id % 15), 960),
                                isWhite(danmaku.color) ? '' : colorCommand(danmaku.color)
                                //isWhite(danmaku.color) ? '' : borderColorCommand(danmaku.color)
                            ];
                            const formatTime = seconds => {
                                const div = (i, j) => Math.floor(i / j);
                                const pad = n => (n < 10 ? '0' + n : '' + n);
                                const integer = Math.floor(seconds);
                                const hour = div(integer, 60 * 60);
                                const minute = div(integer, 60) % 60;
                                const second = integer % 60;
                                const minorSecond = Math.floor((seconds - integer) * 100); // ???????????????2???
                                return `${hour}:${pad(minute)}:${pad(second)}.${minorSecond}`;
                            };
                            const fields = [
                                0, // Layer,
                                formatTime(time), // Start
                                formatTime(time + (danmaku.type === 0 ? scrollTime : fixTime)), // End
                                'Medium', // Style
                                '', // Name
                                '0', // MarginL
                                '0', // MarginR
                                '0', // MarginV
                                '', // Effect
                                '{' + commands.join('') + '}' + encode(text) // Text
                            ];
                            return 'Dialogue: ' + fields.join(',');
                        };
                        // 3.for of
                        const content = [
                            '[Script Info]',
                            '; Script generated by bilibili-parse',
                            '; https://github.com/injahow/bilibili-parse',
                            `Title: ${title}`,
                            'ScriptType: v4.00+',
                            `PlayResX: ${1920}`,
                            `PlayResY: ${1080}`,
                            'Timer: 10.0000',
                            'WrapStyle: 2',
                            'ScaledBorderAndShadow: no',
                            '',
                            '[V4+ Styles]',
                            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
                            'Style: Small,????????????,36,&H66FFFFFF,&H66FFFFFF,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1.2,0,5,0,0,0,0',
                            'Style: Medium,????????????,52,&H66FFFFFF,&H66FFFFFF,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1.2,0,5,0,0,0,0',
                            'Style: Large,????????????,64,&H66FFFFFF,&H66FFFFFF,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1.2,0,5,0,0,0,0',
                            'Style: Larger,????????????,72,&H66FFFFFF,&H66FFFFFF,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1.2,0,5,0,0,0,0',
                            'Style: ExtraLarge,????????????,90,&H66FFFFFF,&H66FFFFFF,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1.2,0,5,0,0,0,0',
                            '',
                            '[Events]',
                            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
                        ];
                        let scroll_id = 0, fix_id = 0;
                        for (const danmaku of danmaku_data) {
                            if (danmaku.type === 0) {
                                scroll_id++;
                            } else {
                                fix_id++;
                            }
                            content.push(dialogue(danmaku, scroll_id, fix_id));
                        }
                        // 4.ass->blob->url
                        const blob_url = URL.createObjectURL(new Blob([content.join('\n')], { type: 'text/ass' }));
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = blob_url;
                        a.download = title + '.ass';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(blob_url);
                    }
                },
                error: () => {
                    //utils.Message.danger('??????????????????')
                }
            });
        }

        function download_subtitle_vtt(p = 0, file_name) {
            const download_subtitle = (blob_url = '') => {
                if (!blob_url) {
                    utils.Message.warning('???????????????')
                    return;
                }
                const a = document.createElement('a');
                a.setAttribute('target', '_blank');
                a.setAttribute('href', blob_url);
                a.setAttribute('download', file_name + '.vtt');
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(blob_url);
            }
            get_subtitle_url(p, download_subtitle);
        }

        // Player
        utils.Player = {
            replace: replace_player,
            recover: recover_player,
            tag: bili_video_tag
        };

        function request_danmaku(options, _cid) {
            if (!_cid) {
                options.error('cid???????????????????????????');
                return;
            }
            $.ajax(`https://api.bilibili.com/x/v1/dm/list.so?oid=${_cid}`, {
                dataType: 'text',
                success: (result) => {
                    const result_dom = $(result.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, ''));
                    if (!result_dom) {
                        options.error('??????????????????');
                        return;
                    }
                    if (!result_dom.find('d')[0]) {
                        options.error('???????????????');
                    } else {
                        const danmaku_data = result_dom.find('d').map((i, el) => {
                            const item = $(el);
                            const p = item.attr('p').split(',');
                            let type = 0;
                            if (p[1] === '4') {
                                type = 2;
                            } else if (p[1] === '5') {
                                type = 1;
                            }
                            return [{ author: '', time: parseFloat(p[0]), type: type, color: parseInt(p[3]), id: '', text: item.text() }];
                        }).get();
                        options.success(danmaku_data);
                    }
                },
                error: () => {
                    options.error('??????????????????');
                }
            });
        }

        let bili_player_id;

        function replace_player(url, url_2) {
            // ???????????????
            recover_player();
            // ???????????????
            const bili_video = $(bili_video_tag())[0];
            bili_video_stop();
            !!bili_video && bili_video.addEventListener('play', bili_video_stop, false);

            if (!!$('#bilibiliPlayer')[0]) {
                bili_player_id = '#bilibiliPlayer';
                $(bili_player_id).before('<div id="my_dplayer" class="bilibili-player relative bilibili-player-no-cursor">');
                $(bili_player_id).hide();
            } else if (!!$('#bilibili-player')[0]) {
                bili_player_id = '#bilibili-player';
                $(bili_player_id).before('<div id="my_dplayer" class="bilibili-player relative bilibili-player-no-cursor" style="width:100%;height:100%;"></div>');
                $(bili_player_id).hide();
            } else if (VideoStatus.type() === 'cheese') {
                if (!!$('div.bpx-player[data-injector="nano"]')[0]) {
                    $('#pay-mask').hide();
                    $('#bofqi').show();
                    bili_player_id = 'div.bpx-player[data-injector="nano"]';
                    $(bili_player_id).before('<div id="my_dplayer" style="width:100%;height:100%;"></div>');
                    $(bili_player_id).hide();
                } else { // ?????????
                    bili_player_id = '#pay-mask';
                    $(bili_player_id).html('<div id="my_dplayer" style="width:100%;height:100%;"></div>');
                }
            }
            $('#player_mask_module').hide();
            const dplayer_init = (subtitle_url = '') => {
                window.my_dplayer = new DPlayer({
                    container: $('#my_dplayer')[0],
                    mutex: false,
                    volume: 1,
                    autoplay: true,
                    video: {
                        url: url,
                        type: 'auto'
                    },
                    subtitle: {
                        url: subtitle_url,
                        type: 'webvtt',
                        fontSize: '35px',
                        bottom: '5%',
                        color: '#fff',
                    },
                    danmaku: true,
                    apiBackend: {
                        read: function (options) {
                            request_danmaku(options, VideoStatus.base().cid());
                        },
                        send: function (options) { // ?
                            options.error('???????????????????????????????????????');
                        }
                    },
                    contextmenu: [
                        {
                            text: '????????????',
                            link: 'https://github.com/injahow/bilibili-parse'
                        },
                        {
                            text: '????????????',
                            link: 'https://injahow.com'
                        }
                    ]
                });

                if (config.format === 'dash' && url_2 && url_2 !== '#') {
                    $('body').append('<div id="my_dplayer_2" style="display:none"></div>');
                    window.my_dplayer_2 = new DPlayer({
                        container: $('#my_dplayer_2')[0],
                        mutex: false,
                        volume: 1,
                        autoplay: true,
                        video: {
                            url: url_2,
                            type: 'auto'
                        }
                    });
                    const my_dplayer = window.my_dplayer;
                    const my_dplayer_2 = window.my_dplayer_2;
                    my_dplayer.on('play', function () {
                        !my_dplayer.paused && my_dplayer_2.play();
                    });
                    my_dplayer.on('playing', function () {
                        !my_dplayer.paused && my_dplayer_2.play();
                    });
                    my_dplayer.on('timeupdate', function () {
                        if (Math.abs(my_dplayer.video.currentTime - my_dplayer_2.video.currentTime) > 1) {
                            my_dplayer_2.pause();
                            my_dplayer_2.seek(my_dplayer.video.currentTime);
                        }
                        !my_dplayer.paused && my_dplayer_2.play();
                    });
                    my_dplayer.on('seeking', function () {
                        my_dplayer_2.pause();
                        my_dplayer_2.seek(my_dplayer.video.currentTime);
                    });
                    my_dplayer.on('waiting', function () {
                        my_dplayer_2.pause();
                        my_dplayer_2.seek(my_dplayer.video.currentTime);
                    });
                    my_dplayer.on('pause', function () {
                        my_dplayer_2.pause();
                        my_dplayer_2.seek(my_dplayer.video.currentTime);
                    });
                    my_dplayer.on('suspend', function () {
                        my_dplayer_2.speed(my_dplayer.video.playbackRate);
                    });
                    my_dplayer.on('volumechange', function () {
                        my_dplayer_2.volume(my_dplayer.video.volume);
                        my_dplayer_2.video.muted = my_dplayer.video.muted;
                    });
                }
            }
            // ??????????????????
            get_subtitle_url(0, dplayer_init);
        }

        function get_subtitle_url(p, callback) {
            const video_base = VideoStatus.base();
            const [aid, cid, epid] = [
                video_base.aid(p),
                video_base.cid(p),
                video_base.epid(p)
            ];
            $.ajax(`https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}&ep_id=${epid}`, {
                dataType: 'json',
                success: res => {
                    if (!res.code && res.data.subtitle.subtitles[0]) {
                        $.ajax(`${res.data.subtitle.subtitles[0].subtitle_url}`, {
                            dataType: 'json',
                            success: res => {
                                // json -> webvtt -> blob_url
                                const datas = res.body || [{ from: 0, to: 0, content: '' }];
                                let webvtt = 'WEBVTT\n\n';
                                for (let data of datas) {
                                    const a = new Date((parseInt(data.from) - 8 * 60 * 60) * 1000).toTimeString().split(' ')[0] +
                                        '.' + (data.from.toString().split('.')[1] || '000').padEnd(3, '0');
                                    const b = new Date((parseInt(data.to) - 8 * 60 * 60) * 1000).toTimeString().split(' ')[0] +
                                        '.' + (data.to.toString().split('.')[1] || '000').padEnd(3, '0');
                                    webvtt += `${a} --> ${b}\n${data.content.trim()}\n\n`;
                                }
                                callback(URL.createObjectURL(new Blob([webvtt], { type: 'text/vtt' })));
                            },
                            error: _ => {
                                callback();
                            }
                        });
                    } else {
                        callback();
                    }
                },
                error: _ => {
                    callback();
                }
            });
        }

        function bili_video_tag() {
            if (!!$('bwp-video')[0]) {
                return 'bwp-video';
            } else if (!!$('video[class!="dplayer-video dplayer-video-current"]')[0]) {
                return 'video[class!="dplayer-video dplayer-video-current"]';
            }
        }

        function bili_video_stop() { // listener
            const bili_video = $(bili_video_tag())[0];
            if (bili_video) {
                bili_video.pause();
                bili_video.currentTime = 0;
            }
        }

        function recover_player() {
            if (window.my_dplayer) {
                utils.Message.info('???????????????');
                const bili_video = $(bili_video_tag())[0];
                !!bili_video && bili_video.removeEventListener('play', bili_video_stop, false);
                window.my_dplayer.destroy();
                window.my_dplayer = null;
                $('#my_dplayer').remove();
                if (window.my_dplayer_2) {
                    window.my_dplayer_2.destroy();
                    window.my_dplayer_2 = null;
                    $('#my_dplayer_2').remove();
                }
                $(bili_player_id).show();
                //$('#player_mask_module').show();
            }
        }

        // Message & MessageBox
        utils.Message = {
            success: html => message(html, 'success'),
            warning: html => message(html, 'warning'),
            danger: html => message(html, 'danger'),
            info: html => message(html, 'info')
        };
        utils.MessageBox = {
            alert: (html, affirm) => messageBox({
                html, callback: { affirm }
            }, 'alert'),
            confirm: (html, affirm, cancel) => messageBox({
                html, callback: { affirm, cancel }
            }, 'confirm')
        };
        const components_css = '' +
            '<style>' +
            '.message-bg{position:fixed;float:right;right:0;top:2%;z-index:10001;}' +
            '.message{margin-bottom:15px;padding:4px 12px;width:300px;display:flex;margin-top:-70px;opacity:0;}' +
            '.message-danger{background-color:#ffdddd;border-left:6px solid #f44336;}' +
            '.message-success{background-color:#ddffdd;border-left:6px solid #4caf50;}' +
            '.message-info{background-color:#e7f3fe;border-left:6px solid #0c86de;}' +
            '.message-warning{background-color:#ffffcc;border-left:6px solid #ffeb3b;}' +
            '.message-context{font-size:21px;word-wrap:break-word;word-break:break-all;}' +
            '.message_box_btn{text-align:right;}.message_box_btn button{margin:0 5px;}' +
            '</style>';
        const components_html = '' +
            '<div class="message-bg"></div>' +
            '<div id="message_box" style="opacity:0;display:none;position:fixed;inset:0px;top:0px;left:0px;width:100%;height:100%;background:rgba(0,0,0,0.7);animation-name:settings-bg;animation-duration:0.3s;z-index:10000;cursor:default;">' +
            '<div style="position:absolute;background:rgb(255,255,255);border-radius:10px;padding:20px;top:50%;left:50%;width:400px;transform:translate(-50%,-50%);cursor:default;">' +
            '<span style="font-size:20px"><b>?????????</b></span>' +
            '<div id="message_box_context" style="margin:2% 0;">...</div><br/><br/>' +
            '<div class="message_box_btn">' +
            '<button class="setting-button" name="affirm">??????</button>' +
            '<button class="setting-button" name="cancel">??????</button></div>' +
            '</div></div>';

        function messageBox(ctx, type) {
            if (type === 'confirm') {
                $('div.message_box_btn button[name="cancel"]').show();
            } else if (type === 'alert') {
                $('div.message_box_btn button[name="cancel"]').hide();
            }
            if (ctx.html) {
                $('div#message_box_context').html(`<div style="font-size:18px">${ctx.html}</div>`);
            } else {
                $('div#message_box_context').html('<div style="font-size:18px">???(?????????)???</div>');
            }
            $('#message_box').show();
            hide_scroll();
            $('div#message_box').animate({
                'opacity': '1'
            }, 300);
            $('div.message_box_btn button[name="affirm"]')[0].onclick = () => {
                $('div#message_box').hide();
                show_scroll();
                if (ctx.callback && ctx.callback.affirm) {
                    ctx.callback.affirm();
                }
            };
            $('div.message_box_btn button[name="cancel"]')[0].onclick = () => {
                $('div#message_box').hide();
                show_scroll();
                if (ctx.callback && ctx.callback.cancel) {
                    ctx.callback.cancel();
                }
            };
        }

        let id = 0;

        function message(html, type) {
            id += 1;
            messageEnQueue(`<div id="message-${id}" class="message message-${type}"><div class="message-context"><p><strong>${type}???</strong></p><p>${html}</p></div></div>`, id);
            messageDeQueue(id, 3);
        }

        function messageEnQueue(message, id) {
            $('div.message-bg').append(message);
            $(`div#message-${id}`).animate({
                'margin-top': '+=70px',
                'opacity': '1',
            }, 300);
        }

        function messageDeQueue(id, time = 3) {
            setTimeout(() => {
                const e = `div#message-${id}`;
                $(e).animate({
                    'margin-top': '-=70px',
                    'opacity': '0',
                }, 300, () => {
                    $(e).remove();
                });
            }, time * 1000);
        }

        $('body').append(components_html + components_css);

        // Scroll ?????????
        utils.Scroll = {
            show: show_scroll,
            hide: hide_scroll
        };

        function show_scroll() {
            if ($('div#my_config').is(':hidden') && $('div#message_box').is(':hidden')) {
                $('body').css('overflow', 'auto');
            }
        }

        function hide_scroll() {
            $('body').css('overflow', 'hidden');
        }

    })();

    // error page redirect -> ss / ep
    if ($('.error-text')[0]) {
        return;
    }

    // video
    let VideoStatus;
    (function () {
        VideoStatus = {
            type, base,
            get_quality, get_quality_support
        };

        function type() {
            if (location.pathname.match('/cheese/play/')) {
                return 'cheese';
            } else if (location.pathname.match('/medialist/play/')) {
                // -/ml*/* or -/watchlater/*
                return 'medialist';
            } else if (!window.__INITIAL_STATE__) {
                // todo
                return '?';
            } else if (!!window.__INITIAL_STATE__.epInfo) {
                return 'bangumi';
            } else if (!!window.__INITIAL_STATE__.videoData) {
                return 'video';
            }
        }

        function base() {
            const _type = type();
            if (_type === 'video') {
                const state = window.__INITIAL_STATE__;
                return {
                    type: 'video',
                    total: () => {
                        return state.videoData.pages.length || 1;
                    },
                    title: (_p) => {
                        const p = _p || state.p || 1;
                        return (state.videoData.pages[p - 1].part || 'unknown').replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    filename: (_p) => {
                        const p = _p || state.p || 1;
                        const title = (state.videoData && state.videoData.title || 'unknown') + ` P${p} ???${state.videoData.pages[p - 1].part || p}???`;
                        return title.replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    aid: (_p) => {
                        return state.videoData.aid;
                    },
                    p: () => {
                        return state.p || 1;
                    },
                    cid: (_p) => {
                        const p = _p || state.p || 1;
                        return state.videoData.pages[p - 1].cid;
                    },
                    epid: (_p) => {
                        return '';
                    },
                    need_vip: () => {
                        return false;
                    },
                    vip_need_pay: () => {
                        return false;
                    },
                    is_limited: () => {
                        return false;
                    }
                };
            } else if (_type === 'medialist') {
                const medialist = $('div.player-auxiliary-playlist-item');
                const _id = $('div.player-auxiliary-playlist-item.player-auxiliary-playlist-item-active').index();
                const collect_name = $('.player-auxiliary-playlist-top .player-auxiliary-filter-title').html();
                let owner_name;
                if (location.pathname.match('/medialist/play/watchlater/')) {
                    owner_name = UserStatus.uname();
                } else {
                    owner_name = $('.player-auxiliary-playlist-user .player-auxiliary-playlist-ownerName').html();
                }
                return {
                    type: 'video',
                    total: () => {
                        return medialist.length;
                    },
                    title: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        const title = medialist.eq(id).find('.player-auxiliary-playlist-item-title').attr('title') || 'unknown';
                        return title.replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    filename: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        const title = medialist.eq(id).find('.player-auxiliary-playlist-item-title').attr('title') || 'unknown';
                        return (`${owner_name}-${collect_name} P${id + 1} ???${title}???`).replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    aid: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return medialist.eq(id).attr('data-aid');
                    },
                    p: () => {
                        return _id + 1;
                    },
                    cid: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return medialist.eq(id).attr('data-cid');
                    },
                    epid: (_p) => {
                        return '';
                    },
                    need_vip: () => {
                        return false;
                    },
                    vip_need_pay: () => {
                        return false;
                    },
                    is_limited: () => {
                        return false;
                    }
                };
            } else if (_type === 'bangumi') {
                const state = window.__INITIAL_STATE__;
                return {
                    type: 'bangumi',
                    total: () => {
                        return state.epList.length;
                    },
                    title: (_p) => {
                        let ep;
                        if (_p) {
                            ep = state.epList[_p - 1];
                        } else {
                            ep = state.epInfo;
                        }
                        return (`${ep.titleFormat} ${ep.longTitle}` || 'unknown').replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    filename: (_p) => {
                        if (_p) {
                            const ep = state.epList[_p - 1];
                            return (`${state.mediaInfo.season_title}???${ep.titleFormat} ${ep.longTitle}` || 'unknown').replace(/[\/\\:*?"<>|]+/g, '');
                        }
                        return (state.h1Title || 'unknown').replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    aid: (_p) => {
                        if (_p) {
                            return state.epList[_p - 1].aid;
                        }
                        return state.epInfo.aid;
                    },
                    p: () => {
                        return state.epInfo.i || 1;
                    },
                    cid: (_p) => {
                        if (_p) {
                            return state.epList[_p - 1].cid;
                        }
                        return state.epInfo.cid;
                    },
                    epid: (_p) => {
                        if (_p) {
                            return state.epList[_p - 1].id;
                        }
                        return state.epInfo.id;
                    },
                    need_vip: () => {
                        return state.epInfo.badge === '??????';
                    },
                    vip_need_pay: () => {
                        return state.epPayMent.vipNeedPay;
                    },
                    is_limited: () => {
                        //return !!steam.conderon.mediaInfo.season_title.match(/???(???|???)???.*???(???|???)???/g);
                        return state.userState.areaLimit;
                    }
                };
            } else if (_type === 'cheese') {
                const episodes = window.PlayerAgent.getEpisodes();
                const _id = $('li.on.list-box-li').index();
                return {
                    type: 'cheese',
                    total: () => {
                        return episodes.length;
                    },
                    title: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return (episodes[id].title || 'unknown').replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    filename: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return (`${$('div.season-info h1').html()} P${id + 1} ???${episodes[id].title || 'unknown'}???`).replace(/[\/\\:*?"<>|]+/g, '');
                    },
                    aid: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return episodes[id].aid;
                    },
                    p: () => {
                        return _id + 1;
                    },
                    cid: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return episodes[id].cid;
                    },
                    epid: (_p) => {
                        let id = _p ? (_p - 1) : _id;
                        return episodes[id].id;
                    },
                    need_vip: () => {
                        return false;
                    },
                    vip_need_pay: () => {
                        return false;
                    },
                    is_limited: () => {
                        return false;
                    }
                };
            } else { // error
                return {
                    type: '?',
                    total: () => { return 0; },
                    title: (_p) => { return ''; },
                    filename: (_p) => { return ''; },
                    aid: (_p) => { return ''; },
                    p: () => { return 1; },
                    cid: (_p) => { return ''; },
                    epid: (_p) => { return ''; },
                    need_vip: () => { return false; },
                    vip_need_pay: () => { return false; },
                    is_limited: () => { return false; }
                };
            }
        }

        function get_quality() {
            let _q = 0, _q_max = 0;
            if (!!$('li.bui-select-item')[0] && !!(_q_max = parseInt($('li.bui-select-item')[0].dataset.value))) {
                _q = parseInt($('li.bui-select-item.bui-select-item-active').attr('data-value')) || (_q_max > 80 ? 80 : _q_max);
            } else if (!!$('li.squirtle-select-item')[0] && !!(_q_max = parseInt($('li.squirtle-select-item')[0].dataset.value))) {
                _q = parseInt($('li.squirtle-select-item.active').attr('data-value')) || (_q_max > 80 ? 80 : _q_max);
            } else {
                _q = _q_max = 80;
            }
            if (!UserStatus.is_login()) {
                _q = _q_max > 80 ? 80 : _q_max;
            }
            return { q: _q, q_max: _q_max };
        }

        function get_quality_support() {
            let list, quality_list = [];
            if (!!$('ul.squirtle-select-list')[0]) {
                list = $('li.squirtle-select-item');
            } else if (!!$('ul.bui-select-list')[0]) {
                list = $('li.bui-select-item');
            }
            if (list && list.length) {
                list.each(function () {
                    const q = `${$(this).attr('data-value')}`;
                    if (q === '0') {
                        return false;
                    }
                    quality_list.push(q);
                });
                return quality_list;
            }
            return ['80', '64', '32', '16'];
        }

    })();

    // check
    let Check;
    (function () {
        Check = {
            aid: '', cid: '', q: '', epid: '',
            refresh
        };

        function refresh() {
            //utils.Message.info('refresh...');
            console.log('refresh...');
            $('#video_download').hide();
            $('#video_download_2').hide();
            utils.Player.recover();
            // ??????check
            const video_base = VideoStatus.base();
            [Check.aid, Check.cid, Check.epid] = [
                video_base.aid(),
                video_base.cid(),
                video_base.epid()
            ];
            Check.q = VideoStatus.get_quality().q;
        }

        // ??????p
        $('body').on('click', 'a.router-link-active', function () {
            if (this !== $('li[class="on"]').find('a')[0]) {
                refresh();
            }
        });
        $('body').on('click', 'li.ep-item', function () {
            refresh();
        });
        $('body').on('click', 'button.bilibili-player-iconfont-next', function () {
            refresh();
        });
        const bili_video_tag = utils.Player.tag();
        !!$(bili_video_tag)[0] && ($(bili_video_tag)[0].onended = function () {
            refresh();
        });
        // ??????q
        $('body').on('click', 'li.bui-select-item', function () {
            refresh();
        });
        setInterval(function () {
            if (Check.q !== VideoStatus.get_quality().q) {
                refresh();
            } else if (VideoStatus.type() === 'cheese') {
                // epid for cheese
                if (Check.epid !== VideoStatus.base().epid()) {
                    refresh();
                }
            }
        }, 1000);
        // ??????aid
        $('body').on('click', '.rec-list', function () {
            refresh();
        });
        $('body').on('click', '.bilibili-player-ending-panel-box-videos', function () {
            refresh();
        });
        // ???????????? aid ??? cid
        setInterval(function () {
            const video_base = VideoStatus.base();
            if (Check.aid !== video_base.aid() || Check.cid !== video_base.cid()) {
                refresh();
            }
        }, 3000);

    })();

    // main
    (function () {
        $('body').append('<a id="video_url" style="display:none" target="_blank" referrerpolicy="origin" href="#"></a>');
        $('body').append('<a id="video_url_2" style="display:none" target="_blank" referrerpolicy="origin" href="#"></a>');
        // ??????????????????...
        setTimeout(function () {
            let my_toolbar;
            if (!!$('#arc_toolbar_report')[0]) {
                my_toolbar = '' +
                    '<div id="arc_toolbar_report_2" style="margin-top:16px" class="video-toolbar report-wrap-module report-scroll-module" scrollshow="true">' +
                    '<div class="ops">' +
                    '<span id="setting_btn"><i class="van-icon-general_addto_s"></i>????????????</span>' +
                    '<span id="bilibili_parse"><i class="van-icon-floatwindow_custome"></i>????????????</span>' +
                    '<span id="video_download" style="display:none"><i class="van-icon-download"></i>????????????</span>' +
                    '<span id="video_download_2" style="display:none"><i class="van-icon-download"></i>????????????</span>' +
                    '<span id="video_download_all"><i class="van-icon-download"></i>????????????</span>' +
                    '</div>' +
                    '<div class="more">' +
                    '<i class="van-icon-general_moreactions"></i><div class="more-ops-list"><ul>' +
                    '<li><span id="download_danmaku">????????????</span></li>' +
                    '<li><span id="download_subtitle">????????????</span></li></ul></div>' +
                    '</div>' +
                    '</div>';
                $('#arc_toolbar_report').after(my_toolbar);
            } else if (!!$('#toolbar_module')[0]) {
                my_toolbar = '' +
                    '<div id="toolbar_module_2" class="tool-bar clearfix report-wrap-module report-scroll-module media-info" scrollshow="true">' +
                    '<div id="setting_btn" class="like-info"><i class="iconfont icon-add"></i><span>????????????</span></div>' +
                    '<div id="bilibili_parse" class="like-info"><i class="iconfont icon-customer-serv"></i><span>????????????</span></div>' +
                    '<div id="video_download" class="like-info" style="display:none"><i class="iconfont icon-download"></i><span>????????????</span></div>' +
                    '<div id="video_download_2" class="like-info" style="display:none"><i class="iconfont icon-download"></i><span>????????????</span></div>' +
                    '<div id="video_download_all" class="like-info"><i class="iconfont icon-download"></i><span>????????????</span></div>' +
                    '<div class="more">??????<div class="more-ops-list"><ul><li><span id="download_danmaku">????????????</span></li><li><span id="download_subtitle">????????????</span></li></ul></div></div>' +
                    '<style>.tool-bar .more{float:right;cursor:pointer;color:#757575;font-size:16px;display:inline-block;transition:all .3s;position:relative;text-align:center}' +
                    '.tool-bar .more:hover .more-ops-list{display:block}' +
                    '.tool-bar:after{display:block;content:"";clear:both}' +
                    '.more-ops-list{display:none;position:absolute;width:80px;left:-65px;z-index:30;text-align:center;padding:10px 0;background:#fff;border:1px solid #e5e9ef;box-shadow:0 2px 4px 0 rgba(0,0,0,.14);border-radius:2px;font-size:14px;color:#222}' +
                    '.more-ops-list li{position:relative;height:34px;line-height:34px;cursor:pointer;transition:all .3s}' +
                    '.more-ops-list li:hover{color:#00a1d6;background:#e7e7e7}' +
                    '</style>' +
                    '</div>';
                $('#toolbar_module').after(my_toolbar);
            } else if (!!$('div.video-toolbar')[0]) {
                my_toolbar = '' +
                    '<div id="arc_toolbar_report_2" style="margin-top:16px" class="video-toolbar report-wrap-module report-scroll-module" scrollshow="true">' +
                    '<div class="ops">' +
                    '<span id="setting_btn"><i class="van-icon-general_addto_s"></i>????????????</span>' +
                    '<span id="bilibili_parse"><i class="van-icon-floatwindow_custome"></i>????????????</span>' +
                    '<span id="video_download" style="display:none"><i class="van-icon-download"></i>????????????</span>' +
                    '<span id="video_download_2" style="display:none"><i class="van-icon-download"></i>????????????</span>' +
                    '<span id="video_download_all"><i class="van-icon-download"></i>????????????</span>' +
                    '</div>' +
                    '<div class="more">' +
                    '<i class="van-icon-general_moreactions"></i><div class="more-ops-list"><ul class="more-ops-list-box">' +
                    '<li class="more-ops-list-box-li"><span id="download_danmaku">????????????</span></li>' +
                    '<li class="more-ops-list-box-li"><span id="download_subtitle">????????????</span></li></ul></div>' +
                    '</div>' +
                    '</div>';
                $('div.video-toolbar').after(my_toolbar);
            }
            UserStatus.lazy_init();
            Auth.check_login_status();
            Check.refresh();
        }, 3000);

        $('body').on('click', '#setting_btn', function () {
            UserStatus.lazy_init(true); // init
            // set form by config
            for (const key in config) {
                $(`#${key}`).val(config[key]);
            }
            $('#my_config').show();
            utils.Scroll.hide();
        });

        $('body').on('click', '#download_danmaku', function () {
            const vb = VideoStatus.base();
            utils.Video.download_danmaku_ass(vb.cid(), vb.filename())
        });

        $('body').on('click', '#download_subtitle', function () {
            utils.Video.download_subtitle_vtt(0, VideoStatus.base().filename());
        });

        $('body').on('click', '#video_download_all', function () {
            UserStatus.lazy_init(true); // init
            if (localStorage.getItem('bp_auth_id') && localStorage.getItem('bp_auth_sec')) {
                if (config.download_type === 'rpc') {
                    utils.Video.download_all();
                } else {
                    utils.MessageBox.confirm('???????????????RPC??????????????????????????????RPC??????????????????????????????', () => {
                        utils.Video.download_all();
                    });
                }
            } else {
                utils.MessageBox.confirm('???????????????????????????????????????RPC????????????????????????????????????', () => {
                    window.bp_show_login();
                });
            }
        });

        $('body').on('click', '#video_download', function () {
            const type = config.download_type;
            if (type === 'web') {
                $('#video_url')[0].click();
            } else if (type === 'a') {
                const [video_url, video_url_2] = [
                    $('#video_url').attr('href'),
                    $('#video_url_2').attr('href')
                ];
                const msg = '????????????IDM???FDM?????????????????????????????????????????????????????????????????????~<br/><br/>' +
                    `<a href="${video_url}" target="_blank" style="text-decoration:underline;">&gt;????????????&lt;</a><br/><br/>` +
                    (config.format === 'dash' ? `<a href="${video_url_2}" target="_blank" style="text-decoration:underline;">&gt;????????????&lt;</a>` : '');
                utils.MessageBox.alert(msg);
            } else if (type === 'aria') {
                const [video_url, video_url_2] = [
                    $('#video_url').attr('href'),
                    $('#video_url_2').attr('href')
                ];
                const video_title = VideoStatus.base().filename();
                let file_name, file_name_2;
                if (video_url.match('.flv')) {
                    file_name = video_title + '.flv';
                } else if (video_url.match('.m4s')) {
                    file_name = video_title + '_video.mp4';
                } else if (video_url.match('.mp4')) {
                    file_name = video_title + '.mp4';
                }
                file_name_2 = video_title + '_audio.mp4';
                const aria2_header = `--header "User-Agent: ${window.navigator.userAgent}" --header "Referer: ${window.location.href}"`;
                const [code, code_2] = [
                    `aria2c "${video_url}" --out "${file_name}" ${aria2_header}`,
                    `aria2c "${video_url_2}" --out "${file_name_2}" ${aria2_header}`
                ]
                const msg = '??????????????????????????????????????????<br/><br/>' +
                    `?????????<br/><input id="aria2_code" value='${code}' onclick="bp_clip_btn('aria2_code')" style="width:100%;"></br></br>` +
                    (config.format === 'dash' ? `?????????<br/><input id="aria2_code_2" value='${code_2}' onclick="bp_clip_btn('aria2_code_2')" style="width:100%;"><br/><br/>` +
                        `?????????<br/><textarea id="aria2_code_all" onclick="bp_clip_btn('aria2_code_all')" style="min-width:100%;max-width:100%;min-height:100px;max-height:100px;">${code}\n${code_2}</textarea>` : '');
                !window.bp_clip_btn && (window.bp_clip_btn = (id) => {
                    $(`#${id}`).select();
                    if (document.execCommand('copy')) {
                        utils.Message.success('????????????');
                    } else {
                        utils.Message.warning('????????????');
                    }
                });
                utils.MessageBox.alert(msg);
            } else {
                const url = $('#video_url').attr('href');
                let file_name = VideoStatus.base().filename();
                if (url.match('.flv')) {
                    file_name += '.flv';
                } else if (url.match('.m4s')) {
                    file_name += '_video.mp4';
                } else if (url.match('.mp4')) {
                    file_name += '.mp4';
                } else {
                    return;
                }
                utils.Video.download(url, file_name, type);
            }
        });

        $('body').on('click', '#video_download_2', function () {
            const type = config.download_type;
            if (type === 'web') {
                $('#video_url_2')[0].click();
            } else if (type === 'a') {
                $('#video_download').click();
            } else if (type === 'aria') {
                $('#video_download').click();
            } else {
                const url = $('#video_url_2').attr('href');
                let file_name = VideoStatus.base().filename();
                if (url.match('.m4s')) {
                    file_name += '_audio.mp4';
                } else {
                    return;
                }
                utils.Video.download(url, file_name, type);
            }
        });

        let api_url, api_url_temp;
        $('body').on('click', '#bilibili_parse', function () {
            UserStatus.lazy_init(true); // init
            const video_base = VideoStatus.base();
            const [type, aid, p, cid, epid] = [
                video_base.type,
                video_base.aid(),
                video_base.p(),
                video_base.cid(),
                video_base.epid()
            ];
            const q = VideoStatus.get_quality().q;
            api_url = `${config.base_api}?av=${aid}&p=${p}&cid=${cid}&ep=${epid}&q=${q}&type=${type}&format=${config.format}&otype=json&_host=${config.host_key}`;
            const [auth_id, auth_sec] = [
                localStorage.getItem('bp_auth_id') || '',
                localStorage.getItem('bp_auth_sec') || ''
            ];
            if (config.auth === '1' && auth_id && auth_sec) {
                api_url += `&auth_id=${auth_id}&auth_sec=${auth_sec}`;
            }
            if (api_url === api_url_temp) {
                utils.Message.info;
                const url = $('#video_url').attr('href');
                const url_2 = $('#video_url_2').attr('href');
                if (url && url !== '#') {
                    $('#video_download').show();
                    config.format === 'dash' && $('#video_download_2').show();
                    if (UserStatus.need_replace() || video_base.is_limited() || config.replace_force === '1') {
                        !$('#my_dplayer')[0] && utils.Player.replace(url, url_2);
                    }
                    if (config.auto_download === '1') {
                        $('#video_download').click();
                    }
                }
                return;
            }
            $('#video_url').attr('href', '#');
            $('#video_url_2').attr('href', '#');
            api_url_temp = api_url;

            utils.Message.info('????????????');
            $.ajax(api_url, {
                dataType: 'json',
                success: (res) => {
                    if (res && !res.code) {
                        utils.Message.success('????????????' + (res.times ? `<br/>????????????????????????${res.times}` : ''));
                        let url = config.format === 'dash' ? res.video.replace('http://', 'https://') : res.url.replace('http://', 'https://');
                        let url_2 = config.format === 'dash' ? res.audio.replace('http://', 'https://') : '#';

                        if (config.hostkeymad.cdky !== '0') {
                            // ????????????CDN??????
                            let url_tmp = url.split('/');
                            url_tmp[2] = hostMap[config.host_key];
                            url = url_tmp.join('/');
                            if (url_2 !== '#') {
                                let url_2_tmp = url_2.split('/');
                                url_2_tmp[2] = hostMap[config.host_key];
                                url_2 = url_2_tmp.join('/');
                            }
                        }

                        $('#video_url').attr('href', url);
                        $('#video_download').show();
                        if (config.format === 'dash') {
                            $('#video_url_2').attr('href', url_2);
                            $('#video_download_2').show();
                        }
                        if (UserStatus.need_replace() || video_base.is_limited() || config.replace_force === '1') {
                            utils.Player.replace(url, url_2);
                        }
                        if (config.auto_download === '1') {
                            $('#video_download').click();
                        }
                    } else {
                        utils.Message.warning('???????????????' + res.message);
                    }
                },
                error: (e) => {
                    utils.Message.danger('????????????');
                    console.log('error', e);
                }
            });
        });
    })();

})();
