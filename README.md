# aliyun-fc-http
## 简介
阿里云函数计算服务node环境http接口适配器. 

将阿里云函数计算http触发模式所提供的接口参数, 转换成node中http服务 IncomingMessage 与 ServerResponse 接口, 以适配任意基于http服务的node框架. 为函数计算提供普通web框架下一样的开发体验

## 安装
通过npm安装
```console
npm install aliyun-fc-http
```

## 使用说明
提供2种方法使用

1.使用aliyun-fc-http中提供的 `createServer` 函数以创建可以接收函数计算数据的server

```typescript
import * as fc from 'aliyun-fc-http'

const server = fc.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello, World!');
  });

export const handler = server.handler
```

2.使用aliyun-fc-http中提供的 `inject` 函数将如上功能注入 `http.createServer` 中

```typescript
import {inject,handler} from 'aliyun-fc-http'
// 如果 typescript的设置中开启 esModuleInterop 选项, inject的执行必须在 import 'http' 之前执行, 否则将注入失败
inject()
import * as http from 'http';

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello, World!');
  });

export {handler}
```
一些框架内置执行了 createServer 的操作, 所以推荐使用第二种方案

## 准备工作
1.阿里云上创建云函数服务 https://fc.console.aliyun.com/

2.如果使用vscode开发, 推荐下载云函数vscode插件 https://help.aliyun.com/document_detail/126086.html

3.使用云函数vscode插件拉取云函数配置 template.yml ,并添加云函数. 或手工配置

## 各框架使用例子
假设在已创建的云函数服务aliyun-fc-http-test中添加了一个名为test的函数,触发方式为http触发. 

template.yml 配置文件内容如下

```yml
ROSTemplateFormatVersion: '2015-09-01'
Transform: 'Aliyun::Serverless-2018-04-03'
Resources:
  aliyun-fc-http-test:
    Type: 'Aliyun::Serverless::Service'
    Properties:
      InternetAccess: true
    test:
      Type: 'Aliyun::Serverless::Function'
      Properties:
        Initializer: index.initializer
        Handler: index.handler
        Runtime: nodejs10
        Timeout: 60
        MemorySize: 512
        EnvironmentVariables: {}
        CodeUri: ./dist
      Events:
        request:
          Type: HTTP
          Properties:
            AuthType: anonymous
            Methods:
              - GET
              - POST
              - PUT
              - DELETE
              - HEAD
```

这里注意运行所需的模块文件夹node_modules, 必须在 CodeUri 字段所指示的运行根路径中. 推荐使用 [copy-node-modules](https://www.npmjs.com/package/copy-node-modules) 模块  , 将项目中的 dependencies 依赖复制进函数计算环境根路径. 对于输出目录为dist的typescript项目, 执行命令为
```console
npx copy-node-modules ./ ./dist
```

函数计算在没有访问量的时候会释放资源, 再次请求时, 需要一定的时间进行初始化操作. 越复杂的框架初始化所需的时间越久. express 初次请求返回的时间需要0.8秒左右, nest.js 则需要3秒. 请根据自己需求选择适合的框架

以下为各框架使用范例,在如上所示配置文件的函数test中,演示Get请求根路径`/`返回'Hello World' , `/time` 路由返回当前时间

### express
```typescript
import { handler, inject } from 'aliyun-fc-http'
import expree from 'express'

function initializer(context?, callback?) {
  const app = expree()
  app.get('/', function (req, res) {
    res.send('Hello World')
  })
  app.get('/time', function (req, res) {
    res.send(new Date().toTimeString())
  })
  // 在云函数计算环境下不起作用
  app.listen(3000)
  callback && callback()
}
// 在阿里云函数计算环境下执行注入http.createServer , 否则直接执行初始化操作 initializer
if (process.env.FC_FUNC_CODE_PATH) {
  inject()
} else {
  initializer();
}

export { handler, initializer }
```

### nest.js
```typescript
import { handler, inject } from 'aliyun-fc-http'
import { Controller, Get, Module} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller()
export class AppController {
  @Get('/time')
  time() {
    return new Date().toTimeString()
  }
  @Get()
  getHello(): string {
    return 'Hello World';
  }
}
@Module({
  imports: [],
  controllers: [AppController],
})
export class AppModule {}

async function initializer(context?, callback?) {
  const app = await NestFactory.create(AppModule)
  // 在云函数计算环境下不起作用
  app.listen(3000)
  callback && callback()
}
// 在阿里云函数计算环境下执行注入http.createServer , 否则直接执行初始化操作 initializer
if (process.env.FC_FUNC_CODE_PATH) {
  inject()
} else {
  initializer();
}

export { handler, initializer }
```

## QQ群
作者的serverless交流QQ群 1075700637

模块初期可能还有很多问题, 欢迎来交流反馈