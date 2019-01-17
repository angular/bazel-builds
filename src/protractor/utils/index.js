/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/protractor-utils", ["require", "exports", "child_process", "net"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var child_process = require("child_process");
    var net = require("net");
    function isTcpPortFree(port) {
        return new Promise(function (resolve, reject) {
            var server = net.createServer();
            server.on('error', function (e) { resolve(false); });
            server.on('close', function () { resolve(true); });
            server.listen(port, function () { server.close(); });
        });
    }
    exports.isTcpPortFree = isTcpPortFree;
    function isTcpPortBound(port) {
        return new Promise(function (resolve, reject) {
            var client = new net.Socket();
            client.once('connect', function () { resolve(true); });
            client.once('error', function (e) { resolve(false); });
            client.connect(port);
        });
    }
    exports.isTcpPortBound = isTcpPortBound;
    function findFreeTcpPort() {
        return __awaiter(this, void 0, void 0, function () {
            var range, i, port;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        range = {
                            min: 32768,
                            max: 60000,
                        };
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < 100)) return [3 /*break*/, 4];
                        port = Math.floor(Math.random() * (range.max - range.min) + range.min);
                        return [4 /*yield*/, isTcpPortFree(port)];
                    case 2:
                        if (_a.sent()) {
                            return [2 /*return*/, port];
                        }
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4: throw new Error('Unable to find a free port');
                }
            });
        });
    }
    exports.findFreeTcpPort = findFreeTcpPort;
    function waitForServer(port, timeout) {
        return isTcpPortBound(port).then(function (isBound) {
            if (!isBound) {
                if (timeout <= 0) {
                    throw new Error('Timeout waiting for server to start');
                }
                var wait_1 = Math.min(timeout, 500);
                return new Promise(function (res, rej) { return setTimeout(res, wait_1); })
                    .then(function () { return waitForServer(port, timeout - wait_1); });
            }
            return true;
        });
    }
    exports.waitForServer = waitForServer;
    /**
     * Runs the specified server binary from a given workspace and waits for the server
     * being ready. The server binary will be resolved from the Bazel runfiles. Note that
     * the server will be launched with a random free port in order to support test concurrency
     * with Bazel.
     */
    function runServer(workspace, serverTarget, portFlag, serverArgs, timeout) {
        if (timeout === void 0) { timeout = 5000; }
        return __awaiter(this, void 0, void 0, function () {
            var serverPath, port, serverProcess;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        serverPath = require.resolve(workspace + "/" + serverTarget);
                        return [4 /*yield*/, findFreeTcpPort()];
                    case 1:
                        port = _a.sent();
                        serverProcess = child_process.spawn(serverPath, serverArgs.concat([portFlag, port.toString()]), { stdio: 'inherit' });
                        // In case the process exited with an error, we want to propagate the error.
                        serverProcess.on('exit', function (exitCode) {
                            if (exitCode !== 0) {
                                throw new Error("Server exited with error code: " + exitCode);
                            }
                        });
                        // Wait for the server to be bound to the given port.
                        return [4 /*yield*/, waitForServer(port, timeout)];
                    case 2:
                        // Wait for the server to be bound to the given port.
                        _a.sent();
                        return [2 /*return*/, { port: port }];
                }
            });
        });
    }
    exports.runServer = runServer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvcHJvdHJhY3Rvci91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkNBQStDO0lBQy9DLHlCQUEyQjtJQUczQixTQUFnQixhQUFhLENBQUMsSUFBWTtRQUN4QyxPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDakMsSUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFVBQUMsQ0FBQyxJQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLGNBQVEsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBUSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFQRCxzQ0FPQztJQUVELFNBQWdCLGNBQWMsQ0FBQyxJQUFZO1FBQ3pDLE9BQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtZQUNqQyxJQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxjQUFRLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxJQUFJLENB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QUFDLElBQUksTUFBQSxFQUFDLEVBQUM7Ozs7S0FDZjtJQXJCRCw4QkFxQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGNoaWxkX3Byb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBuZXQgZnJvbSAnbmV0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1RjcFBvcnRGcmVlKHBvcnQ6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKTtcbiAgICBzZXJ2ZXIub24oJ2Vycm9yJywgKGUpID0+IHsgcmVzb2x2ZShmYWxzZSk7IH0pO1xuICAgIHNlcnZlci5vbignY2xvc2UnLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgIHNlcnZlci5saXN0ZW4ocG9ydCwgKCkgPT4geyBzZXJ2ZXIuY2xvc2UoKTsgfSk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNUY3BQb3J0Qm91bmQocG9ydDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgY2xpZW50ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICBjbGllbnQub25jZSgnY29ubmVjdCcsICgpID0+IHsgcmVzb2x2ZSh0cnVlKTsgfSk7XG4gICAgY2xpZW50Lm9uY2UoJ2Vycm9yJywgKGUpID0+IHsgcmVzb2x2ZShmYWxzZSk7IH0pO1xuICAgIGNsaWVudC5jb25uZWN0KHBvcnQpO1xuICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRGcmVlVGNwUG9ydCgpOiBQcm9taXNlPG51bWJlcj4ge1xuICBjb25zdCByYW5nZSA9IHtcbiAgICBtaW46IDMyNzY4LFxuICAgIG1heDogNjAwMDAsXG4gIH07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMTAwOyBpKyspIHtcbiAgICBsZXQgcG9ydCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChyYW5nZS5tYXggLSByYW5nZS5taW4pICsgcmFuZ2UubWluKTtcbiAgICBpZiAoYXdhaXQgaXNUY3BQb3J0RnJlZShwb3J0KSkge1xuICAgICAgcmV0dXJuIHBvcnQ7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgYSBmcmVlIHBvcnQnKTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciBjb25maWcgcGFyYW1ldGVyIG9mIHRoZSBwcm90cmFjdG9yX3dlYl90ZXN0X3N1aXRlIG9uUHJlcGFyZSBmdW5jdGlvblxuZXhwb3J0IGludGVyZmFjZSBPblByZXBhcmVDb25maWcge1xuICAvLyBUaGUgd29ya3NwYWNlIG5hbWVcbiAgd29ya3NwYWNlOiBzdHJpbmc7XG5cbiAgLy8gVGhlIHNlcnZlciBiaW5hcnkgdG8gcnVuXG4gIHNlcnZlcjogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2FpdEZvclNlcnZlcihwb3J0OiBudW1iZXIsIHRpbWVvdXQ6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gaXNUY3BQb3J0Qm91bmQocG9ydCkudGhlbihpc0JvdW5kID0+IHtcbiAgICBpZiAoIWlzQm91bmQpIHtcbiAgICAgIGlmICh0aW1lb3V0IDw9IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yIHNlcnZlciB0byBzdGFydCcpO1xuICAgICAgfVxuICAgICAgY29uc3Qgd2FpdCA9IE1hdGgubWluKHRpbWVvdXQsIDUwMCk7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiBzZXRUaW1lb3V0KHJlcywgd2FpdCkpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gd2FpdEZvclNlcnZlcihwb3J0LCB0aW1lb3V0IC0gd2FpdCkpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG59XG5cbi8vIFJldHVybiB0eXBlIGZyb20gcnVuU2VydmVyIGZ1bmN0aW9uXG5leHBvcnQgaW50ZXJmYWNlIFNlcnZlclNwZWMge1xuICAvLyBQb3J0IG51bWJlciB0aGF0IHRoZSBzZXJ2ZXIgaXMgcnVubmluZyBvblxuICBwb3J0OiBudW1iZXI7XG59XG5cbi8qKlxuICogUnVucyB0aGUgc3BlY2lmaWVkIHNlcnZlciBiaW5hcnkgZnJvbSBhIGdpdmVuIHdvcmtzcGFjZSBhbmQgd2FpdHMgZm9yIHRoZSBzZXJ2ZXJcbiAqIGJlaW5nIHJlYWR5LiBUaGUgc2VydmVyIGJpbmFyeSB3aWxsIGJlIHJlc29sdmVkIGZyb20gdGhlIEJhemVsIHJ1bmZpbGVzLiBOb3RlIHRoYXRcbiAqIHRoZSBzZXJ2ZXIgd2lsbCBiZSBsYXVuY2hlZCB3aXRoIGEgcmFuZG9tIGZyZWUgcG9ydCBpbiBvcmRlciB0byBzdXBwb3J0IHRlc3QgY29uY3VycmVuY3lcbiAqIHdpdGggQmF6ZWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5TZXJ2ZXIoXG4gICAgd29ya3NwYWNlOiBzdHJpbmcsIHNlcnZlclRhcmdldDogc3RyaW5nLCBwb3J0RmxhZzogc3RyaW5nLCBzZXJ2ZXJBcmdzOiBzdHJpbmdbXSxcbiAgICB0aW1lb3V0ID0gNTAwMCk6IFByb21pc2U8U2VydmVyU3BlYz4ge1xuICBjb25zdCBzZXJ2ZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKGAke3dvcmtzcGFjZX0vJHtzZXJ2ZXJUYXJnZXR9YCk7XG4gIGNvbnN0IHBvcnQgPSBhd2FpdCBmaW5kRnJlZVRjcFBvcnQoKTtcblxuICAvLyBTdGFydCB0aGUgQmF6ZWwgc2VydmVyIGJpbmFyeSB3aXRoIGEgcmFuZG9tIGZyZWUgVENQIHBvcnQuXG4gIGNvbnN0IHNlcnZlclByb2Nlc3MgPSBjaGlsZF9wcm9jZXNzLnNwYXduKFxuICAgICAgc2VydmVyUGF0aCwgc2VydmVyQXJncy5jb25jYXQoW3BvcnRGbGFnLCBwb3J0LnRvU3RyaW5nKCldKSwge3N0ZGlvOiAnaW5oZXJpdCd9KTtcblxuICAvLyBJbiBjYXNlIHRoZSBwcm9jZXNzIGV4aXRlZCB3aXRoIGFuIGVycm9yLCB3ZSB3YW50IHRvIHByb3BhZ2F0ZSB0aGUgZXJyb3IuXG4gIHNlcnZlclByb2Nlc3Mub24oJ2V4aXQnLCBleGl0Q29kZSA9PiB7XG4gICAgaWYgKGV4aXRDb2RlICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBleGl0ZWQgd2l0aCBlcnJvciBjb2RlOiAke2V4aXRDb2RlfWApO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gV2FpdCBmb3IgdGhlIHNlcnZlciB0byBiZSBib3VuZCB0byB0aGUgZ2l2ZW4gcG9ydC5cbiAgYXdhaXQgd2FpdEZvclNlcnZlcihwb3J0LCB0aW1lb3V0KTtcblxuICByZXR1cm4ge3BvcnR9O1xufVxuIl19