var cp=require('child_process')
var fs=require('fs')
var resolve=require('path').resolve
var Promise=require('bluebird')
var pngjs=require('pngjs')
var bufferImageSearch=require('../buffer-image-search')
var bufferImageCrop = require('../buffer-image-crop');

var execAsync=Promise.promisify(cp.exec)
var unlinkAsync=Promise.promisify(fs.unlink)

// TODO crop is not a responsibility of this module

/**
 * @typedef {Object} Image
 * @property {Number} width
 * @property {Number} height
 * @property {Buffer} data - raw image data in 4 byte/pixel encoding
 */

/**
 * 
 * @param {Object} [opts]
 * @param {String} [opts.tempPath] - default: "<cwd>/_screenshot_temp.png"
 * @param {String|Image} opts.cropMarker - 
 * @param {} opts.outfile - 
 * @param {} opts. - 
 * @return {[type]}           [description]
 */
module.exports=Promise.method(function(opts){
    opts=opts||{}

    var tempPath=resolve(opts.tempPath || '_screenshot_temp.png')

    return Promise.try(_=> {

        if (process.platform==='win32'){
            var screenshotCmdPath = resolve(__dirname, 'platform_modules/screenshot-cmd/screenshot-cmd.exe')

            return execAsync(`${screenshotCmdPath} -o ${tempPath}`)
        }
        else {
            // TODO
        }
    })
    .then(_=>new Promise((res,rej)=>{
        fs.createReadStream(tempPath)
        .pipe(new pngjs.PNG())
        .on('parsed', function () {
            res({width:this.width,height:this.height,data:this.data})
        })
    }))
    .then(img=>{
        if (!opts.cropMarker)return img

        return Promise.try(_=>{
            if (typeof opts.cropMarker === 'string') {
                return new Promise((res,rej)=>{
                    fs.createReadStream(resolve(opts.cropMarker))
                    .pipe(new pngjs.PNG())
                    .on('parsed', function () {
                        res({width:this.width,height:this.height,data:this.data})
                    })
                })
            }
            else {
                return opts.cropMarker
            }
        })
        .then(marker=>{
            var markerPositions=bufferImageSearch(img, marker)

            if (markerPositions.length !== 2){
                throw new Error('Marker count is not 2! Found '+markerPositions.length)
            }

            var cropDimensions={
                x:markerPositions[0].x,
                y:markerPositions[0].y,
                width:markerPositions[1].x - markerPositions[0].x + marker.width,
                height: markerPositions[1].y - markerPositions[0].y + marker.height,
            }

            return bufferImageCrop(img, cropDimensions)
            
        })
    })
    .then(img=>{
        return unlinkAsync(tempPath)
        .then(_=>{
            if (opts.outfile) {
                return new Promise((res,rej)=>{
                    var png=new pngjs.PNG(img)
                    png.data=img.data
                    
                    png
                    .pack()
                    .pipe(fs.createWriteStream(resolve(opts.outfile)))
                    .on('error', rej)
                    .on('end', res)
                })
            }
        })
        .then(_=>({
            width: img.width,
            height: img.height,
            data: img.data
        }))
    })
})
