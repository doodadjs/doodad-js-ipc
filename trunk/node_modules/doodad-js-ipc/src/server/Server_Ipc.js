//! REPLACE_BY("// Copyright 2016 Claude Petit, licensed under Apache License version 2.0\n")
// dOOdad - Object-oriented programming framework
// File: Server_Ipc.js - Server tools
// Project home: https://sourceforge.net/projects/doodad-js/
// Trunk: svn checkout svn://svn.code.sf.net/p/doodad-js/code/trunk doodad-js-code
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2016 Claude Petit
//
//	Licensed under the Apache License, Version 2.0 (the "License");
//	you may not use this file except in compliance with the License.
//	You may obtain a copy of the License at
//
//		http://www.apache.org/licenses/LICENSE-2.0
//
//	Unless required by applicable law or agreed to in writing, software
//	distributed under the License is distributed on an "AS IS" BASIS,
//	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//	See the License for the specific language governing permissions and
//	limitations under the License.
//! END_REPLACE()

(function() {
	const global = this;

	var exports = {};
	if (typeof process === 'object') {
		module.exports = exports;
	};
	
	exports.add = function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.Server.Ipc'] = {
			type: null,
			version: '0.2.2a',
			namespaces: ['Interfaces', 'MixIns', 'Extenders'],
			dependencies: [
				'Doodad.Types', 
				'Doodad.Tools', 
				{
					name: 'Doodad',
					version: '2.2.0',
				}, 
				{
					name: 'Doodad.IO',
					version: '1.0.0',
				}, 
				{
					name: 'Doodad.Server',
					version: '0.3.0',
				}, 
			],

			create: function create(root, /*optional*/_options) {
				"use strict";

				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					namespaces = doodad.Namespaces,	
					mixIns = doodad.MixIns,
					interfaces = doodad.Interfaces,
					extenders = doodad.Extenders,
					io = doodad.IO,
					server = doodad.Server,
					serverInterfaces = server.Interfaces,
					serverMixIns = server.MixIns,
					ipc = server.Ipc,
					ipcInterfaces = ipc.Interfaces,
					ipcMixIns = ipc.MixIns,
					ipcExtenders = ipc.Extenders;
					
					
				//const __Internal__ = {
				//};

				
				ipc.Error = types.createErrorType('IpcError', types.Error);
				ipc.InvalidRequest = types.createErrorType('InvalidRequest', ipc.Error, function(message, params) {
					ipc.Error.call(this, message || "Invalid request.", params);
				});
				ipc.MethodNotCallable = types.createErrorType('MethodNotCallable', ipc.Error, function(message, params) {
					ipc.Error.call(this, message || "Method '~0~.~1~' is not callable or doesn't exist.", params);
				});
				
				ipcExtenders.REGISTER(extenders.Method.$inherit({
					$TYPE_NAME: "Callable",
				}));

				// Modifier to set a method of a service as IPC/RPC callable
				ipc.CALLABLE = function CALLABLE(/*optional*/fn) {
					if (root.DD_ASSERT) {
						const val = types.unbox(fn);
						root.DD_ASSERT(types.isNothing(val) || types.isJsFunction(val), "Invalid function.");
					};
					return doodad.RETURNS(types.isSerializable, doodad.ATTRIBUTE(fn, ipcExtenders.Callable));
				};
				
				ipc.isCallable = function isCallable(obj, name) {
					const isType = types.isType(obj),
						type = types.getType(obj);
					if (!type) {
						return false;
					};
					const attrs = types.getAttribute(type, '$__ATTRIBUTES');
					if (!types.hasKey(attrs, name)) {
						return false;
					};
					const attr = attrs[name],
						extender = attr.EXTENDER;
					if (!types.isLike(extender, ipcExtenders.Callable)) {
						return false;
					};
					return ((isType && extender.isType) || (!isType && extender.isInstance));
				};
					
				ipc.REGISTER(doodad.BASE(doodad.Object.$extend(
									serverMixIns.Request,
				{
					$TYPE_NAME: 'Request',
					
					method: doodad.PUBLIC(doodad.READ_ONLY(null)),
					args: doodad.PUBLIC(doodad.READ_ONLY(null)),
					session: doodad.PUBLIC(doodad.READ_ONLY(null)),
					
					create: doodad.OVERRIDE(function(server, method, /*optional*/args, /*optional*/session) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._implements(server, ipcInterfaces.IServer), "Invalid server.");
							root.DD_ASSERT(types.isString(method), "Invalid method.");
							root.DD_ASSERT(types.isNothing(args) || types.isArray(args), "Invalid method arguments.");
							root.DD_ASSERT(types.isNothing(session) || (session instanceof server.Session), "Invalid session.");
						};
						this._super();
						types.setAttributes(this, {
							server: server,
							method: method,
							args: args,
							session : session,
							customData: {},
						});
					}),
				})));

				// What an object must implement to be an IPC/RPC Service
				ipcMixIns.REGISTER(doodad.ISOLATED(doodad.MIX_IN(doodad.Class.$extend(
									serverInterfaces.Response,
				{
					$TYPE_NAME: 'Service',

					// Override this attribute with current version of the service. Client's version and server's version must be the same.
					version: doodad.PUBLIC(doodad.READ_ONLY( 0 )),
					
					// Implement with state-full services. Must listen to "session.onDestroy" to free resources.
					initSession: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()), // function initSession(session, /*optional*/options)
					
					execute: doodad.OVERRIDE(function execute(request) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(request instanceof ipc.Request, "Invalid request.");
						};
						if (!ipc.isCallable(this.__host, request.method)) {
							throw new ipc.MethodNotCallable(null, [types.getTypeName(this.__host), request.method]);
						};
						return types.invoke(this.__host, request.method, types.append([request], request.args));
					}),
				}))));
				
				// Interface to implement for the ServiceManager at client and server side
				ipcInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'IServiceManager',

					// NOTE: "PUBLIC" to allow in-process call				
					getService: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()),
					callService: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()),
					releaseService: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()),
				})));
				
				// What an IPC/RPC Client must implement
				// - One IPC client type per IPC server type
				ipcMixIns.REGISTER(doodad.MIX_IN(doodad.Class.$extend(
									ipcInterfaces.IServiceManager,
				{
					$TYPE_NAME: 'IClient',
					
					connect: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function connect(/*optional*/options)
					callMethod: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function callMethod(method, /*optional*/args, /*optional*/options)
					disconnect: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function disconnect()
					
					getService: doodad.OVERRIDE(function getService(svcName, /*optional*/svcOptions, /*optional*/options) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isString(svcName), "Invalid service name.");
							root.DD_ASSERT(types.isNothing(svcOptions) || types.isObject(svcOptions), "Invalid service options.");
						};
						// Returns an svcToken
						return this.callMethod('getService', [svcName, svcOptions], options);
					}),
					callService: doodad.OVERRIDE(function callService(svcToken, method, /*optional*/args, /*optional*/options) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isString(svcToken) || types.isObject(svcToken), "Invalid service token.");
							root.DD_ASSERT(types.isString(method), "Invalid method name.");
							root.DD_ASSERT(types.isNothing(args) || types.isArray(args), "Invalid method arguments.");
						};
						return this.callMethod('callService', [svcToken, method, args], options);
					}),
					releaseService: doodad.OVERRIDE(function releaseService(svcToken, /*optional*/options) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isObject(svcToken), "Invalid service token.");
						};
						return this.callMethod('releaseService', [svcToken], options);
					}),
				})));

				ipc.REGISTER(doodad.BASE(doodad.Object.$extend(
									ipcMixIns.IClient,
				{
					$TYPE_NAME: 'Client',
				})));
				
				// What an IPC/RPC Server must implement
				// - One IPC server type per protocol (XML-RPC, JSON-RPC, JSON-WSP, ...)
				ipcInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'IServer',
					
					service: doodad.PUBLIC(doodad.READ_ONLY(  null  )),  // Can be "ServiceManager" or another service
				})));
				
				ipc.REGISTER(doodad.BASE(doodad.Object.$extend(
									serverInterfaces.Server,
									ipcInterfaces.IServer,
				{
					$TYPE_NAME: 'Server',
					
					create: doodad.OVERRIDE(function create(service) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._implements(service, ipcMixIns.Service), "Invalid service.");
						};
						this._super();
						types.setAttribute(this, 'service', service);
					}),
				})));
				
				ipc.REGISTER(ipc.Request.$extend(
				{
					$TYPE_NAME: 'ServiceManagerRequest',
					
					innerRequest: doodad.PUBLIC(doodad.READ_ONLY(  null  )),
					
					create: doodad.OVERRIDE(function create(innerRequest, server, method, /*optional*/args, /*optional*/session) {
						this._super(server, method, args, session);

						types.setAttributes(this, {
							innerRequest: innerRequest,
							customData: {},
						});
					}),
					
					end: doodad.OVERRIDE(function end(/*optional*/result) {
						this.innerRequest.end(result);
					}),

					respondWithError: doodad.OVERRIDE(function respondWithError(ex) {
						this.innerRequest.respondWithError(ex);
					}),
				}));

				// What an object must implement to be an IPC/RPC Service Manager
				ipc.REGISTER(doodad.Object.$extend(
									ipcInterfaces.IServiceManager,
									ipcInterfaces.IServer,
									ipcMixIns.Service,
				{
					$TYPE_NAME: 'ServiceManager',

					__servicesByName: doodad.PROTECTED(  null  ),
					__servicesById: doodad.PROTECTED(  null  ),
					
					create: doodad.OVERRIDE(function create() {
						this._super();
						
						this.__servicesByName = {};
						this.__servicesById = {};
					}),
					
					createManagerRequest: doodad.PROTECTED(function createManagerRequest(request, method, args, session) {
						return new ipc.ServiceManagerRequest(request, this, method, args, session);
					}),
					
					registerService: doodad.PROTECTED(function registerService(svcName, svc) {
						const servicesByName = this.__servicesByName,
							servicesById = this.__servicesById;
						if (types.hasKey(servicesByName, svcName)) {
							return false;
						};
						let id;
						do {
							id = tools.generateUUID();
						} while (types.hasKey(servicesById, id));
						svc = {
							id: id,
							obj: svc,
							hasSessions: types.isImplemented(svc, 'initSession'),
						};
						servicesByName[svcName] = svc;
						servicesById[svc.id] = svc;
						return svc;
					}),
					getServiceFromName: doodad.PROTECTED(function getServiceFromName(svcName) {
						const services = this.__servicesByName;
						if (!types.hasKey(services, svcName)) {
							return null;
						};
						return services[svcName];
					}),
					getServiceFromToken: doodad.PROTECTED(function getServiceFromToken(svcToken) {
						root.DD_ASSERT && root.DD_ASSERT(types.isObject(svcToken), "Invalid service token.");
						const services = this.__servicesById;
						if (!svcToken) {
							return null;
						};
						const id = svcToken.serviceId;
						if (!types.hasKey(services, id)) {
							return null;
						};
						return services[id];
					}),
					getServiceToken: doodad.PROTECTED(function getServiceToken(svc, /*optional*/session) {
						return {
							serviceId: svc.id,
							sessionId: session && session.id,
						};
					}),
					
					getSessionFromToken: doodad.PROTECTED(function getSessionFromToken(svcToken) {
						// TODO: Implement
					}),
					createSession: doodad.PROTECTED(function createSession() {
						// TODO: Implement
					}),
					
					
					__getService: doodad.PROTECTED(function __getService(request, svcName, /*optional*/options) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isString(svcName), "Invalid service name.");
							root.DD_ASSERT(types.isNothing(options) || types.isObject(options), "Invalid options.");
						};
						let isStateFull,
							svc = this.getServiceFromName(svcName);
						if (!svc) {
							svc = namespaces.getNamespace(svcName);
							if (!types._implements(svc, ipcMixIns.Service)) {
								throw new types.TypeError(tools.format("Unknown service : '~0~'.", [svcName]));
							};
							if (types.isType(svc)) {
								svc = svc.$createInstance();
							};
							svc = svc.getInterface(ipcMixIns.Service);
							svc = this.registerService(svcName, svc);
						};
						if (types.get(options, 'version', 0) !== svc.obj.version) {
							throw new types.TypeError(tools.format("Invalid version. Service version is '~0~'.", [svc.version]));
						};
						let session = null;
						if (svc.hasSessions) {
							session = this.createSession();
							svc.obj.initSession(session, options);
						};
						return this.getServiceToken(svc, options, session);
					}),
					
					getService: doodad.OVERRIDE(ipc.CALLABLE(function getService(request, svcName, /*optional*/options) {
						const result = request.customData.lastServiceToken = this.__getService(request, svcName, options);
						request.end(result);
					})),
					
					callService: doodad.OVERRIDE(ipc.CALLABLE(function callService(request, svcToken, method, /*optional*/args) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT((svcToken === -1) || types.isString(svcToken) || types.isObject(svcToken), "Invalid service token.");
							root.DD_ASSERT(types.isString(method), "Invalid method name.");
							root.DD_ASSERT(types.isNothing(args) || types.isArray(args), "Invalid method arguments.");
						};
						let release = false;
						if (svcToken === -1) {
							svcToken = request.customData.lastServiceToken;
						} else if (types.isString(svcToken)) {
							svcToken = this.__getService(request, svcToken);
							release = true;
						};
						let newRequest = null;
						try {
							const svc = this.getServiceFromToken(svcToken);
							if (!svc) {
								throw new ipc.Error("Invalid service token.");
							};
							const session = this.getSessionFromToken(svcToken);
							newRequest = this.createManagerRequest(request, method, args, session);
							return svc.obj.execute(newRequest);
						} catch(ex) {
							if (!(ex instanceof server.EndOfRequest)) {
								if (newRequest) {
									newRequest.respondWithError(ex);
								} else {
									request.respondWithError(ex);
								};
							} else {
								throw ex;
							};
						} finally {
							if (release) {
								this.__releaseService(request, svcToken);
							};
						};
					})),
					
					__releaseService: doodad.PROTECTED(function __releaseService(request, svcToken) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT((svcToken === -1) || types.isObject(svcToken), "Invalid service token.");
						};
						if (svcToken === -1) {
							svcToken = request.customData.lastServiceToken;
						};
						const svc = this.getServiceFromToken(svcToken);
						if (svc) {			
							const session = svc.hasSessions && this.getSessionFromToken(svcToken);
							if (session) {
								session.destroy();
							};
						};
					}),
					
					releaseService: doodad.OVERRIDE(ipc.CALLABLE(function releaseService(request, svcToken) {
						this.__releaseService(request, svcToken);
						request.end();
					})),
				}));



				
				ipc.RequestCallback = types.setPrototypeOf(function(request, obj, fn) {
					if (types.isString(fn)) {
						fn = obj[fn];
					};
					fn = types.makeInside(obj, fn);
					let callback = function requestCallback(/*paramarray*/) {
						try {
							if (!request.isDestroyed()) {
								return fn.apply(obj, arguments);
							};
						} catch(ex) {
							const max = 5; // prevents infinite loop
							let count = 0,
								abort = false;
							while (count < max) {
								count++;
								try {
									if (types._instanceof(ex, server.EndOfRequest)) {
										// Do nothing
									} else if (types._instanceof(ex, types.ScriptAbortedError)) {
										abort = true;
									} else {
										// Internal or server error.
										request.respondWithError(ex);
									};
									break;
								} catch(o) {
									ex = o;
								};
								if (abort) {
									throw ex;
								};
								if (count >= max) {
									// Failed to respond with internal error.
									try {
										doodad.trapException(obj, ex, attr);
									} catch(o) {
									};
									try {
										request.destroy();
									} catch(o) {
									};
								};
							};
						};
					};
					callback = types.setPrototypeOf(callback, ipc.RequestCallback);
					return callback;
				}, types.Callback);
				
			},
		};
		
		return DD_MODULES;
	};
	
	if (typeof process !== 'object') {
		// <PRB> export/import are not yet supported in browsers
		global.DD_MODULES = exports.add(global.DD_MODULES);
	};
}).call((typeof global !== 'undefined') ? global : ((typeof window !== 'undefined') ? window : this));