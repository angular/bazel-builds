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
        define("@angular/bazel/protractor-utils", ["require", "exports", "child_process", "net", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var child_process = require("child_process");
    var net = require("net");
    var path = require("path");
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
    function runServer(workspace, binary, portFlag, args, timeout) {
        if (timeout === void 0) { timeout = 5000; }
        return findFreeTcpPort().then(function (port) {
            var runfiles_path = process.env.TEST_SRCDIR;
            var cmd = path.join(runfiles_path, workspace, binary);
            args = args.concat([portFlag, port.toString()]);
            var child = child_process.spawn(cmd, args, { cwd: path.join(runfiles_path, workspace), stdio: 'inherit' });
            child.on('exit', function (code) {
                if (code != 0) {
                    throw new Error("non-zero exit code " + code + " from server");
                }
            });
            return waitForServer(port, timeout).then(function () { return { port: port }; });
        });
    }
    exports.runServer = runServer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvcHJvdHJhY3Rvci91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkNBQStDO0lBQy9DLHlCQUEyQjtJQUMzQiwyQkFBNkI7SUFFN0IsU0FBZ0IsYUFBYSxDQUFDLElBQVk7UUFDeEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFDLE9BQU8sRUFBRSxNQUFNO1lBQ2pDLElBQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQyxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxVQUFDLENBQUMsSUFBTyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxjQUFRLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQVEsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBUEQsc0NBT0M7SUFFRCxTQUFnQixjQUFjLENBQUMsSUFBWTtRQUN6QyxPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDakMsSUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsY0FBUSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqRCxNQUFN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Q0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxPQUFPLGFBQWEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQVEsT0FBTyxFQUFDLElBQUksTUFBQSxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFwQkQsOEJBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBjaGlsZF9wcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgbmV0IGZyb20gJ25ldCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNUY3BQb3J0RnJlZShwb3J0OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG4gICAgc2VydmVyLm9uKCdlcnJvcicsIChlKSA9PiB7IHJlc29sdmUoZmFsc2UpOyB9KTtcbiAgICBzZXJ2ZXIub24oJ2Nsb3NlJywgKCkgPT4geyByZXNvbHZlKHRydWUpOyB9KTtcbiAgICBzZXJ2ZXIubGlzdGVuKHBvcnQsICgpID0+IHsgc2VydmVyLmNsb3NlKCk7IH0pO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGNwUG9ydEJvdW5kKHBvcnQ6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGNsaWVudCA9IG5ldyBuZXQuU29ja2V0KCk7XG4gICAgY2xpZW50Lm9uY2UoJ2Nvbm5lY3QnLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgIGNsaWVudC5vbmNlKCdlcnJvcicsIChlKSA9PiB7IHJlc29sdmUoZmFsc2UpOyB9KTtcbiAgICBjbGllbnQuY29ubmVjdChwb3J0KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kRnJlZVRjcFBvcnQoKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgY29uc3QgcmFuZ2UgPSB7XG4gICAgbWluOiAzMjc2OCxcbiAgICBtYXg6IDYwMDAwLFxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IDEwMDsgaSsrKSB7XG4gICAgbGV0IHBvcnQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAocmFuZ2UubWF4IC0gcmFuZ2UubWluKSArIHJhbmdlLm1pbik7XG4gICAgaWYgKGF3YWl0IGlzVGNwUG9ydEZyZWUocG9ydCkpIHtcbiAgICAgIHJldHVybiBwb3J0O1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIGEgZnJlZSBwb3J0Jyk7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY29uZmlnIHBhcmFtZXRlciBvZiB0aGUgcHJvdHJhY3Rvcl93ZWJfdGVzdF9zdWl0ZSBvblByZXBhcmUgZnVuY3Rpb25cbmV4cG9ydCBpbnRlcmZhY2UgT25QcmVwYXJlQ29uZmlnIHtcbiAgLy8gVGhlIHdvcmtzcGFjZSBuYW1lXG4gIHdvcmtzcGFjZTogc3RyaW5nO1xuXG4gIC8vIFRoZSBzZXJ2ZXIgYmluYXJ5IHRvIHJ1blxuICBzZXJ2ZXI6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JTZXJ2ZXIocG9ydDogbnVtYmVyLCB0aW1lb3V0OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgcmV0dXJuIGlzVGNwUG9ydEJvdW5kKHBvcnQpLnRoZW4oaXNCb3VuZCA9PiB7XG4gICAgaWYgKCFpc0JvdW5kKSB7XG4gICAgICBpZiAodGltZW91dCA8PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGltZW91dCB3YWl0aW5nIGZvciBzZXJ2ZXIgdG8gc3RhcnQnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHdhaXQgPSBNYXRoLm1pbih0aW1lb3V0LCA1MDApO1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4gc2V0VGltZW91dChyZXMsIHdhaXQpKVxuICAgICAgICAgIC50aGVuKCgpID0+IHdhaXRGb3JTZXJ2ZXIocG9ydCwgdGltZW91dCAtIHdhaXQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xufVxuXG4vLyBSZXR1cm4gdHlwZSBmcm9tIHJ1blNlcnZlciBmdW5jdGlvblxuZXhwb3J0IGludGVyZmFjZSBTZXJ2ZXJTcGVjIHtcbiAgLy8gUG9ydCBudW1iZXIgdGhhdCB0aGUgc2VydmVyIGlzIHJ1bm5pbmcgb25cbiAgcG9ydDogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuU2VydmVyKFxuICAgIHdvcmtzcGFjZTogc3RyaW5nLCBiaW5hcnk6IHN0cmluZywgcG9ydEZsYWc6IHN0cmluZywgYXJnczogc3RyaW5nW10sXG4gICAgdGltZW91dCA9IDUwMDApOiBQcm9taXNlPFNlcnZlclNwZWM+IHtcbiAgcmV0dXJuIGZpbmRGcmVlVGNwUG9ydCgpLnRoZW4oZnVuY3Rpb24ocG9ydCkge1xuICAgIGNvbnN0IHJ1bmZpbGVzX3BhdGggPSBwcm9jZXNzLmVudi5URVNUX1NSQ0RJUjtcbiAgICBjb25zdCBjbWQgPSBwYXRoLmpvaW4ocnVuZmlsZXNfcGF0aCwgd29ya3NwYWNlLCBiaW5hcnkpO1xuXG4gICAgYXJncyA9IGFyZ3MuY29uY2F0KFtwb3J0RmxhZywgcG9ydC50b1N0cmluZygpXSk7XG5cbiAgICBjb25zdCBjaGlsZCA9IGNoaWxkX3Byb2Nlc3Muc3Bhd24oXG4gICAgICAgIGNtZCwgYXJncywge2N3ZDogcGF0aC5qb2luKHJ1bmZpbGVzX3BhdGgsIHdvcmtzcGFjZSksIHN0ZGlvOiAnaW5oZXJpdCd9KTtcblxuICAgIGNoaWxkLm9uKCdleGl0JywgZnVuY3Rpb24oY29kZSkge1xuICAgICAgaWYgKGNvZGUgIT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG5vbi16ZXJvIGV4aXQgY29kZSAke2NvZGV9IGZyb20gc2VydmVyYCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gd2FpdEZvclNlcnZlcihwb3J0LCB0aW1lb3V0KS50aGVuKCgpID0+IHsgcmV0dXJuIHtwb3J0fTsgfSk7XG4gIH0pO1xufVxuIl19