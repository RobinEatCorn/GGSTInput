var content = document.getElementById('content');
var t_last = 0

const GGSTKeyType = Object.freeze({
    UP: 0,
    DOWN: 1,
    LEFT: 2,
    RIGHT: 3,

    PUNCH: 4,
    KICK: 5,
    SLASH: 6,
    HEAVYSLASH: 7,
    DUST: 8,
    ROMANCANCEL: 9,
    DASH: 10,
})

const GGSTKeyState = Object.freeze({
    UP: 0,
    DOWN: 1
})

function frames_of(msec){
    return Math.floor(msec * 60 / 1000)
}

class GGSTTime {
    constructor() {
        this.frames = 0
        this.start_msec = 0
    }

    update_msec(msec) {
        if(0 == this.start_msec){
            this.start_msec = msec
            this.frames = 0
            return 0
        } else {
            let current_frames = frames_of(msec - this.start_msec)
            let diff_frames = current_frames - this.frames
            this.frames = current_frames
            return diff_frames
        }
    }

    reset() {
        this.frames = 0
        this.start_msec = 0
    }

    next_frame_msec() {
        return this.start_msec + Math.ceil(( this.frames + 1 ) * 1000 / 60)
    }
}

class GGSTKey {
    constructor(typ, key) {
        this.type = typ
        this.key = key
        this.state = GGSTKeyState.UP
        this.downlock = 0
    }

    reset() {
        this.state = GGSTKeyState.UP
        this.downlock = 0
    }

    down() {
        this.state = GGSTKeyState.DOWN
        this.downlock = 1
    }

    down_unlock(){
        this.downlock = 0
    }

    get_state() {
        return this.downlock || this.state
    }

    is_down() {
        return this.state == GGSTKeyState.DOWN
    }

    up() {
        this.state = GGSTKeyState.UP
    }
}

class GGSTPad {
    constructor() {
        this.type2key = []
        this.key2key = {}
    }

    reset() {
        for(key of this.type2key)
            if(key)
                key.reset()
    }

    register_key(key) {
        this.type2key[key.type] = key
        this.key2key[key.key] = key
    }

    has_unreleased_downlocks() {
        for(key of this.type2key)
            if(1 == key.downlock && GGSTKeyState.UP == key.state)
                return true
        return false
    }

    down_unlock() {
        for(key of this.type2key)
            if(key)
                key.down_unlock()
    }

    get_direction() {
        return - this.type2key[GGSTKeyType.LEFT].get_state()
               + this.type2key[GGSTKeyType.RIGHT].get_state()
               - 3 * this.type2key[GGSTKeyType.DOWN].get_state()
               + 3 * this.type2key[GGSTKeyType.UP].get_state()
               + 5
    }

    get_act() {
        let text = ''
        if(this.type2key[GGSTKeyType.PUNCH].get_state() == GGSTKeyState.DOWN)
            text+='P'
        if(this.type2key[GGSTKeyType.KICK].get_state() == GGSTKeyState.DOWN)
            text+='K'
        if(this.type2key[GGSTKeyType.SLASH].get_state() == GGSTKeyState.DOWN)
            text+='S'
        if(this.type2key[GGSTKeyType.HEAVYSLASH].get_state() == GGSTKeyState.DOWN)
            text+='H'
        if(this.type2key[GGSTKeyType.DUST].get_state() == GGSTKeyState.DOWN)
            text+='D'
        if(this.type2key[GGSTKeyType.ROMANCANCEL].get_state() == GGSTKeyState.DOWN)
            text+='C'
        if(this.type2key[GGSTKeyType.DASH].get_state() == GGSTKeyState.DOWN)
            text+='dash'

        return text
    }
}

function frame_text(c){
    if(c <= 1){
        return ''
    } else if (c == 2) {
        return ' '
    } else if (c <= 60) {
        let remain = c - 2
        ten_count = Math.floor(remain / 10)
        remain -= 10 * ten_count
        five_count = Math.floor(remain / 5)
        remain -= 5 * five_count
        two_count = Math.floor(remain / 2)
        remain -= 2 * two_count
        one_count = remain
        return '>'.repeat(ten_count) +
               '~'.repeat(five_count) +
               '='.repeat(two_count) +
               '-'.repeat(one_count)
    } else {
        return '(' + c + ')'
    }
}

class InputSeries {
    constructor(pad, time) {
        this.text = ""
        this.last_cmd = ''
        this.last_diff_frames = 0
        this.pad = pad
        this.time = time
    }

    get_text() {
        return this.text + frame_text(this.last_diff_frames) + this.last_cmd
    }

    update_downlock(msec) {
        let next_frame_msec = this.time.next_frame_msec()
        if(msec >= next_frame_msec){
            let has_unreleased_downlocks = this.pad.has_unreleased_downlocks()
            this.pad.down_unlock()
            if(has_unreleased_downlocks){
                this.time.update_msec(next_frame_msec)
                this.text += frame_text(this.last_diff_frames) + this.last_cmd
                this.last_cmd = ''
                this.last_diff_frames = 1
                this.last_cmd = this.pad.get_direction() + this.pad.get_act()
            }
        }
    }

    update(key, updown, msec) {
        switch(updown){
            case GGSTKeyState.DOWN:
                if(key.is_down())
                    return this.get_text()
                this.update_downlock(msec)
                key.down()
                break
            case GGSTKeyState.UP:
                this.update_downlock(msec)
                key.up()
                break
            default:
                return this.get_text()
        }
        let diff_frames = this.time.update_msec(msec)

        if(diff_frames > 0){
            this.text += frame_text(this.last_diff_frames) + this.last_cmd
            this.last_cmd = ''
            this.last_diff_frames = diff_frames
        }
        this.last_cmd = this.pad.get_direction() + this.pad.get_act()

        return this.get_text()
    }

    clear() {
        this.text = ""
        this.last_cmd = ''
        this.last_diff_frames = 0
        this.time.reset()
        this.pad.reset()
    }
}

pad = new GGSTPad()
pad.register_key(new GGSTKey(GGSTKeyType.UP,          ' '))
pad.register_key(new GGSTKey(GGSTKeyType.DOWN,        's'))
pad.register_key(new GGSTKey(GGSTKeyType.LEFT,        'a'))
pad.register_key(new GGSTKey(GGSTKeyType.RIGHT,       'd'))
pad.register_key(new GGSTKey(GGSTKeyType.PUNCH,       'u'))
pad.register_key(new GGSTKey(GGSTKeyType.KICK,        'j'))
pad.register_key(new GGSTKey(GGSTKeyType.SLASH,       'i'))
pad.register_key(new GGSTKey(GGSTKeyType.HEAVYSLASH,  'k'))
pad.register_key(new GGSTKey(GGSTKeyType.DUST,        'o'))
pad.register_key(new GGSTKey(GGSTKeyType.ROMANCANCEL, 'l'))
pad.register_key(new GGSTKey(GGSTKeyType.DASH,        ';'))

time = new GGSTTime()

series = new InputSeries(pad, time)

document.addEventListener('keydown', function(e){
    let msec = Date.now()
    //console.log('down ' + e.key)
    key = pad.key2key[e.key]
    if(key){
        //console.log('msec=' + msec + ' key ' + e.key + ' down')
        content.textContent = series.update(key, GGSTKeyState.DOWN, msec)
    } else if ( 'c' == e.key ) {
        series.clear()
        content.textContent = ""
    } else
        return
});

document.addEventListener('keyup', function(e){
    let msec = Date.now()
    //console.log('up ' + e.key)
    key = pad.key2key[e.key]
    if(key){
        //console.log('msec=' + msec + ' key ' + e.key + ' up')
        content.textContent = series.update(key, GGSTKeyState.UP, msec)
    } else
        return

});
