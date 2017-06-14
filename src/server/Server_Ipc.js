//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2017 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: Server_Ipc.js - Server tools
// Project home: https://github.com/doodadjs/
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2015-2017 Claude Petit
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

module.exports = {
	add: function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.Server.Ipc'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			namespaces: ['Interfaces', 'MixIns', 'Extenders'],

			create: function create(root, /*optional*/_options, _shared) {
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
					serverMixIns = server.MixIns,
					ipc = server.Ipc,
					ipcInterfaces = ipc.Interfaces,
					ipcMixIns = ipc.MixIns,
					ipcExtenders = ipc.Extenders;
					
					
				//const __Internal__ = {
				//};

				
				ipc.REGISTER(types.createErrorType('Error', types.Error, function(/*optional*/message, /*optional*/params) {
					this._this.bubble = true;
					this.superArgs = [message || "General IPC error.", params];
				}));
				ipc.REGISTER(types.createErrorType('InvalidRequest', ipc.Error, function(/*optional*/message, /*optional*/params) {
					this.superArgs = [message || "Invalid request.", params];
				}));
				ipc.REGISTER(types.createErrorType('MethodNotCallable', ipc.Error, function(/*optional*/message, /*optional*/params) {
					this.superArgs = [message || "Method '~1~' of '~0~' is not callable or doesn't exist.", params];
				}));
				
				ipcExtenders.REGISTER([], extenders.Method.$inherit({
					$TYPE_NAME: "Callable",
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('CallableExtender')), true) */,
				}));

				// Modifier to set a method of a service as IPC/RPC callable
				ipc.ADD('CALLABLE', function CALLABLE(/*optional*/fn) {
					if (root.DD_ASSERT) {
						const val = types.unbox(fn);
						root.DD_ASSERT(types.isNothing(val) || types.isJsFunction(val), "Invalid function.");
					};
					return doodad.ASYNC(doodad.ATTRIBUTE(fn, ipcExtenders.Callable));
				});
				
				ipc.ADD('isCallable', function isCallable(obj, name) {
					const attr = _shared.getAttributeDescriptor(obj, name);
					if (!attr) {
						return false;
					};
					const extender = attr[_shared.ExtenderSymbol];
					if (!types.isLike(extender, ipcExtenders.Callable)) {
						return false;
					};
					const isType = types.isType(obj);
					return ((isType && extender.isType) || (!isType && extender.isInstance));
				});
				
				ipc.REGISTER(doodad.BASE(doodad.Object.$extend(
									serverMixIns.Request,
				{
					$TYPE_NAME: 'Request',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('RequestBase')), true) */,
					
					session: doodad.PUBLIC(doodad.READ_ONLY(null)),
					data: doodad.PUBLIC(doodad.READ_ONLY(null)),

					create: doodad.OVERRIDE(function create(server, /*optional*/session) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._implements(server, ipcInterfaces.IServer), "Invalid server.");
							root.DD_ASSERT(types.isNothing(session) || types._instanceof(session, server.Session), "Invalid session.");
						};

						this._super();

						_shared.setAttributes(this, {
							server: server,
							data: types.nullObject(),
						});

						this.setSession(session);
					}),
					
					catchError: doodad.OVERRIDE(function catchError(ex) {
						const max = 5; // prevents infinite loop
						let count = 0;
						const _catchError = function _catchError(ex) {
							if (count >= max) {
								// Failed to respond with internal error.
								try {
									doodad.trapException(ex);
								} catch(o) {
								};
								throw ex;
							} else if (_shared.DESTROYED(this)) {
								if (ex.critical || !ex.bubble) {
									throw ex;
								};
							} else {
								count++;
								if (types._instanceof(ex, ipc.Error)) {
									return this.respondWithError(ex)
										.catch(_catchError, this);
								} else if (types._instanceof(ex, server.EndOfRequest)) {
									// Do nothing
								} else if (ex.critical) {
									throw ex;
								} else if (ex.bubble) {
									return this.end()
										.catch(_catchError, this);
								} else {
									// Internal or server error.
									return this.respondWithError(ex)
										.catch(_catchError, this);
								};
							};
						};

						return _catchError.call(this, ex);
					}),

					respondWithError: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function respondWithError(ex)

					setSession: doodad.PUBLIC(function setSession(session) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isNothing(session) || types._instanceof(session, server.Session), "Invalid session.");
						};
						
						_shared.setAttribute(this, 'session', session);
					}),
				})));

				// What an object must implement to be an IPC Service
				ipcMixIns.REGISTER(doodad.ISOLATED(doodad.MIX_IN(doodad.Class.$extend(
									serverMixIns.Response,
				{
					$TYPE_NAME: 'Service',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('ServiceIsolatedMixIn')), true) */,

					// Override this attribute with current version of the service. Client's version and server's version must be the same.
					version: doodad.PUBLIC(doodad.READ_ONLY( 0 )),
					
					// Implement with state-full services. Must listen to "session.onDestroy" to free resources.
					initSession: doodad.PUBLIC(doodad.NOT_IMPLEMENTED()), // function initSession(session, /*optional*/options)
					
					execute: doodad.OVERRIDE(function execute(request, method, /*optional*/args) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._instanceof(request, ipc.Request), "Invalid request.");
							root.DD_ASSERT(types.isString(method), "Invalid method name.");
							root.DD_ASSERT(types.isNothing(args) || types.isArray(args), "Invalid method arguments.");
						};
						if (!ipc.isCallable(this[doodad.HostSymbol], method)) {
							throw new ipc.MethodNotCallable(null, [types.getTypeName(this[doodad.HostSymbol]), method]);
						};
						return _shared.invoke(this[doodad.HostSymbol], method, types.append([request], args), _shared.SECRET);
					}),
				}))));
				
				// Interface to implement for the ServiceManager at client and server side
				ipcInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'IServiceManager',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('IServiceManagerInterface')), true) */,

					// NOTE: "PUBLIC" to allow in-process call				
					getService: doodad.PUBLIC(ipc.CALLABLE(doodad.ASYNC(doodad.NOT_IMPLEMENTED()))), // function(svcName, /*optional*/svcOptions, /*optional*/options)
					callService: doodad.PUBLIC(ipc.CALLABLE(doodad.ASYNC(doodad.NOT_IMPLEMENTED()))), // function(svcToken, method, /*optional*/args, /*optional*/options)
					releaseService: doodad.PUBLIC(ipc.CALLABLE(doodad.ASYNC(doodad.NOT_IMPLEMENTED()))), // function(svcToken, /*optional*/options)
				})));
				
				// What an IPC/RPC Client must implement
				// - One IPC client type per IPC server type
				ipcMixIns.REGISTER(doodad.MIX_IN(doodad.Class.$extend(
									ipcInterfaces.IServiceManager,
				{
					$TYPE_NAME: 'IClient',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('IServiceManagerMixIn')), true) */,
					
					connect: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function connect(/*optional*/options)
					callMethod: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function callMethod(method, /*optional*/args, /*optional*/options)
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
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('ClientBase')), true) */,
				})));
				
				// What an IPC/RPC Server must implement
				// - One IPC server type per protocol (XML-RPC, JSON-RPC, JSON-WSP, ...)
				ipcInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'IServer',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('IServerInterface')), true) */,
					
					service: doodad.PUBLIC(doodad.READ_ONLY(  null  )),  // Can be "ServiceManager" or another service
				})));
				
				ipc.REGISTER(doodad.BASE(doodad.Object.$extend(
									serverMixIns.Server,
									ipcInterfaces.IServer,
				{
					$TYPE_NAME: 'Server',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('ServerBase')), true) */,
					
					create: doodad.OVERRIDE(function create(service) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._implements(service, ipcMixIns.Service), "Invalid service.");
						};
						this._super();
						_shared.setAttribute(this, 'service', service);
					}),
				})));
				
				// What an object must implement to be an IPC Service Manager
				ipc.REGISTER(doodad.Object.$extend(
									ipcInterfaces.IServiceManager,
									ipcInterfaces.IServer,
									ipcMixIns.Service,
				{
					$TYPE_NAME: 'ServiceManager',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('ServiceManager')), true) */,

					__servicesByName: doodad.PROTECTED(  null  ),
					__servicesById: doodad.PROTECTED(  null  ),
					__serviceInterfaces: doodad.PROTECTED( ipcMixIns.Service ),
					
					create: doodad.OVERRIDE(function create() {
						this._super();
						
						this.__servicesByName = {};
						this.__servicesById = {};
					}),
					
					registerService: doodad.PROTECTED(function registerService(svcName, svc) {
						const servicesByName = this.__servicesByName,
							servicesById = this.__servicesById;
						if (types.has(servicesByName, svcName)) {
							return servicesByName[svcName];
						};
						let count = 5,
							id;
						do {
							id = tools.generateUUID();
							count--;
						} while ((count > 0) && types.has(servicesById, id));
						if (count <= 0) {
							return null;
						};
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
						if (!types.has(services, svcName)) {
							return null;
						};
						return services[svcName];
					}),
					getServiceFromToken: doodad.PROTECTED(function getServiceFromToken(svcToken) {
						root.DD_ASSERT && root.DD_ASSERT(types.isNothing(svcToken) || types.isObject(svcToken), "Invalid service token.");
						if (!svcToken) {
							return null;
						};
						const services = this.__servicesById;
						const id = svcToken.serviceId;
						if (!types.has(services, id)) {
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
					
					getSessionFromToken: doodad.PROTECTED(doodad.ASYNC(function getSessionFromToken(svcToken) {
						// TODO: Implement sessions
					})),
					createSession: doodad.PROTECTED(doodad.ASYNC(function createSession() {
						// TODO: Implement sessions
					})),
					
					
					__getService: doodad.PROTECTED(doodad.ASYNC(function __getService(request, svcName, /*optional*/options) {
						const Promise = types.getPromise();
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isString(svcName), "Invalid service name.");
							root.DD_ASSERT(types.isNothing(options) || types.isObject(options), "Invalid options.");
						};
						let isStateFull,
							svc = this.getServiceFromName(svcName);
						if (!svc) {
							svc = namespaces.get(svcName);
							if (!types._implements(svc, this.__serviceInterfaces)) {
								throw new ipc.InvalidRequest("Unknown service : '~0~'.", [svcName]);
							};
							if (types.isType(svc)) {
								svc = svc.$createInstance();
							};
							svc = svc.getInterface(ipcMixIns.Service);
							svc = this.registerService(svcName, svc);
						};
						if (!svc) {
							throw new ipc.Error("Unable to retrieve the service '~0~'.", [svcName]);
						};
						if (types.get(options, 'version', 0) !== svc.obj.version) {
							throw new ipc.InvalidRequest("Invalid version. Service version is '~0~'.", [svc.obj.version]);
						};
						let sessionPromise = null;
						if (svc.hasSessions) {
							sessionPromise = this.createSession()
								.then(function initSessionPromise(session) {
									svc.obj.initSession(session, options);
									return session;
								});
						} else {
							sessionPromise = Promise.resolve(null);
						};
						return sessionPromise
							.then(function getTokenPromise(session) {
								return this.getServiceToken(svc, options, session);
							}, this);
					})),
					
					getService: doodad.OVERRIDE(function getService(request, svcName, /*optional*/options) {
						return this.__getService(request, svcName, options)
							.then(function(token) {
								request.data.lastServiceToken = token;
								return token;
							});
					}),
					
					callService: doodad.OVERRIDE(function callService(request, svcToken, method, /*optional*/args) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT((svcToken === -1) || types.isString(svcToken) || types.isObject(svcToken), "Invalid service token.");
							root.DD_ASSERT(types.isString(method), "Invalid method name.");
							root.DD_ASSERT(types.isNothing(args) || types.isArray(args), "Invalid method arguments.");
						};
						const Promise = types.getPromise();
						let release = false,
							tokenPromise;
						if (types.isString(svcToken)) {
							release = true;
							tokenPromise = this.__getService(request, svcToken);
						} else if (svcToken === -1) { // Previous service token
							tokenPromise = Promise.resolve(request.data.lastServiceToken);
						} else {
							tokenPromise = Promise.resolve(svcToken);
						};
						return tokenPromise
							.then(function proceedToken(token) {
								const svc = this.getServiceFromToken(token);
								if (!svc) {
									throw new ipc.InvalidRequest("Invalid service token.");
								};
								return this.getSessionFromToken(token)
									.then(function executeRequestPromise(session) {
										request.setSession(session);
										return svc.obj.execute(request, method, args);
									}, null, this)
									.nodeify(function cleanupPromise(err, result) {
										let promise = Promise.resolve();
										if (release) {
											promise = promise.then(function() {
												return this.releaseService(request, token);
											}, null, this);
										};
										return promise.then(function(dummy) {
											if (err) {
												throw err;
											} else {
												return result;
											};
										});
									}, this);
							}, null, this);
					}),
					
					releaseService: doodad.OVERRIDE(function releaseService(request, svcToken) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT((svcToken === -1) || types.isObject(svcToken), "Invalid service token.");
						};
						if (svcToken === -1) {
							svcToken = request.data.lastServiceToken;
						};
						const svc = this.getServiceFromToken(svcToken);
						if (svc) {
							if (svc.hasSessions) {
								return this.getSessionFromToken(svcToken)
									.then(function deleteSessionPromise(session) {
										session.remove();
										types.DESTROY(session);
									});
							};
						};
					}),
				}));
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()