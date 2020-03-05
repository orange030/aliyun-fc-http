/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/ban-ts-ignore */

import * as http from 'http'
import { Readable, Transform } from 'stream'
import { EventEmitter } from 'events'

interface AliyunRequest extends EventEmitter{
  events:object
  getHeader(key:string):string|null
  headers:{[key:string]:string}
  method:string
  path:string
  queries:{[key:string]:string}
  url:string
  clientIP:string
}

function SetFromOutgoingHttpHeaders(respone : AliyunResponse, headers:http.OutgoingHttpHeaders){
    // const out : {[key:string]:string} = {}
    const keys = Object.keys(headers)
    for(let i=0;i<keys.length;++i){
        let value = headers[keys[i]]
        if(Array.isArray(value)){
            value = value.join('; ')
        }else if(typeof value == 'number'){
            value = value.toString()
        }
        // out[key] = value
        respone.setHeader(keys[i],value)
    }
    // return out
}

class ResponseWrap extends http.ServerResponse{
    constructor(request:RequestWrap,respone : AliyunResponse){
        super(request)
        let stream:Transform 
        let sent = false
        // let preEnd = false
        let sendIndex = 0
        //@ts-ignore
        this._send = (data, encoding, callback)=>{
            // console.log('_send')
            // console.log(data, encoding)
            // chunkedEncoding 模式下, 每4次_send ,第三次真实数据内容 , 第一次是数据长度,第二四次是分隔符
            this.chunkedEncoding && ((sendIndex++)%4==2) && stream && stream.write(data, encoding, callback)
            if(sent){
                return
            }
            SetFromOutgoingHttpHeaders(respone,this.getHeaders())
            respone.setStatusCode(this.statusCode)
            if(!this.chunkedEncoding){
                respone.send(data)
            }else{
                //https://stackoverflow.com/a/35564274
                stream = new Transform()
                stream._transform = function (chunk,encoding,done) 
                {
                    stream.push(chunk)
                    done()
                }
                respone.send(stream)
            }
            sent = true
          }
        //@ts-ignore
        this.end = (chunk, encoding, callback)=>{
            // preEnd = true
            super.end(chunk, encoding, callback)
            this.emit('prefinish');
            stream && stream.end()
        }
        // this.on('error',err=>console.error)
    }
}

class RequestWrap extends Readable implements http.IncomingMessage {
  url:string
  baseUrl:string
  originalUrl:string
  method:string

  constructor(request:AliyunRequest,url:string){
    super({highWaterMark:16384})
    this._read = (n)=>{}
    //@ts-ignore
    this.on = (event,lisener) => request.on(event,lisener) && this
    this.removeListener = (event,lisener) => request.removeListener(event,lisener) && this
    this.baseUrl = ''
    this.url = url
    this.originalUrl = url
    this.method = request.method
    this.headers = request.headers
    //@ts-ignore
    this.connection = {
        remoteAddress : request.clientIP
    }
  }
  httpVersion: string
  httpVersionMajor: number
  httpVersionMinor: number
  complete: boolean
  connection: import("net").Socket
  socket: import("net").Socket
  headers: http.IncomingHttpHeaders
  rawHeaders: string[]
  trailers: { [key: string]: string }
  rawTrailers: string[]
  setTimeout(msecs: number, callback?: () => void): this {
    // throw new Error("Method not implemented.")
    return this
  }
}


interface AliyunContext {
  function:{
    name:string
  }
  service:{
    name:string
  }
}
interface AliyunResponse{
    setHeader(headerKey:string, headerValue:string):void
    headers:{[key:string]:string}
    hasHeader(headerKey:string):boolean
    setStatusCode(statusCode:number):void
    deleteHeader(headerKey:string):void
    send(body: Buffer|string|Readable):void
}

class AliyunServer extends http.Server{
    handler:(request, response, context)=>void
    listen(...params){return this}
    constructor(requestListener:http.RequestListener){
        super()
        this.handler = (request, response, context)=>{
            // console.log('handler(request, response, context)')
            const urlPrefix = '/proxy/'+(context as AliyunContext).service.name+'/'+(context as AliyunContext).function.name
            let url = (request as AliyunRequest).url
            url = url.substring( url.indexOf(urlPrefix)+urlPrefix.length )
            const requestWrap = new RequestWrap(request as AliyunRequest,url||'/')
            const responseWrap = new ResponseWrap(requestWrap,response)
            requestListener(requestWrap,responseWrap)
        }
    }
}

let _server: AliyunServer

export function handler(request, response, context){
    _server.handler(request, response, context)
}

export function createServer (requestListener:http.RequestListener){
    return new AliyunServer(requestListener)
}

export function inject(){
    // @ts-ignore
    http.createServer = (requestListener)=>{
        return _server = createServer(requestListener)
    }
}