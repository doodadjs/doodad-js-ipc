IPC/RPC server (alpha).

[![NPM Version][npm-image]][npm-url]
 
<<<< PLEASE UPGRADE TO THE LATEST VERSION AS OFTEN AS POSSIBLE >>>>

## Installation

```bash
$ npm install doodad-js-ipc
```

## Features

  -  IPC/RPC management.
  -  Exposable services.
  -  Services manager and locator.
  -  Sessions (not fully developed).

## Quick Start

By default, Doodad is running in production mode, which disables every validations. You may want to activate the development mode by setting the "NODE_ENV" environment variable :

Windows :
```dos
    set NODE_ENV=development
```
Linux :
```bash
    export NODE_ENV=development
```
Now create the root namespace :
```js
    const root = require('doodad-js').createRoot();
```

You can create a shortcut to the namespaces this way :
```js
    const doodad = root.Doodad,
        types = doodad.Types,
        tools = doodad.Tools,
        mixins = doodad.MixIns,
        interfaces = doodad.Interfaces,
        extenders = doodad.Extenders,
        namespaces = doodad.Namespaces,
        ... ;
```

Then load 'doodad-js-ipc' and its dependencies :
```js
    const modules = {};
    require('doodad-js-io').add(modules);
    require('doodad-js-server').add(modules);
    require('doodad-js-ipc').add(modules);
    
    function startup() {
        // your code here...
    };
    
    namespaces.load(modules, startup);
```

## Example

Please install "doodad-js-test" and browse its source code. Begin with file "./src/server/units/index.js".

## Other available packages

  - **doodad-js-cluster**: Cluster manager (alpha)
  - **doodad-js-dates**: Dates formatting (release)
  - **doodad-js-http**: Http server (alpha)
  - **doodad-js-http_jsonrpc**: JSON-RPC over http server (alpha)
  - **doodad-js-io**: I/O module (alpha)
  - **doodad-js-loader**: Scripts loader (beta)
  - **doodad-js-locale**: Locales (release)
  - **doodad-js-make**: Make tools for doodad (alpha)
  - **doodad-js-mime**: Mime types (beta)
  - **doodad-js-minifiers**: Javascript minifier used by doodad (alpha)
  - **doodad-js-server**: Servers base module (alpha)
  - **doodad-js-templates**: HTML page templates (alpha)
  - **doodad-js-terminal**: Terminal (alpha)
  - **doodad-js-test**: Test application
  - **doodad-js-widgets**: Widgets base module (alpha)
  - **doodad-js-xml**: DOM XML parser (release)
  
## License

  [Apache-2.0][license-url]

[npm-image]: https://img.shields.io/npm/v/doodad-js-ipc.svg
[npm-url]: https://npmjs.org/package/doodad-js-ipc
[license-url]: http://opensource.org/licenses/Apache-2.0