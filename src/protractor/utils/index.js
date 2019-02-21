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
    const child_process = require("child_process");
    const net = require("net");
    function isTcpPortFree(port) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.on('error', (e) => { resolve(false); });
            server.on('close', () => { resolve(true); });
            server.listen(port, () => { server.close(); });
        });
    }
    exports.isTcpPortFree = isTcpPortFree;
    function isTcpPortBound(port) {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.once('connect', () => { resolve(true); });
            client.once('error', (e) => { resolve(false); });
            client.connect(port);
        });
    }
    exports.isTcpPortBound = isTcpPortBound;
    function findFreeTcpPort() {
        return __awaiter(this, void 0, void 0, function* () {
            const range = {
                min: 32768,
                max: 60000,
            };
            for (let i = 0; i < 100; i++) {
                let port = Math.floor(Math.random() * (range.max - range.min) + range.min);
                if (yield isTcpPortFree(port)) {
                    return port;
                }
            }
            throw new Error('Unable to find a free port');
        });
    }
    exports.findFreeTcpPort = findFreeTcpPort;
    function waitForServer(port, timeout) {
        return isTcpPortBound(port).then(isBound => {
            if (!isBound) {
                if (timeout <= 0) {
                    throw new Error('Timeout waiting for server to start');
                }
                const wait = Math.min(timeout, 500);
                return new Promise((res, rej) => setTimeout(res, wait))
                    .then(() => waitForServer(port, timeout - wait));
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
    function runServer(workspace, serverTarget, portFlag, serverArgs, timeout = 5000) {
        return __awaiter(this, void 0, void 0, function* () {
            const serverPath = require.resolve(`${workspace}/${serverTarget}`);
            const port = yield findFreeTcpPort();
            // Start the Bazel server binary with a random free TCP port.
            const serverProcess = child_process.spawn(serverPath, serverArgs.concat([portFlag, port.toString()]), { stdio: 'inherit' });
            // In case the process exited with an error, we want to propagate the error.
            serverProcess.on('exit', exitCode => {
                if (exitCode !== 0) {
                    throw new Error(`Server exited with error code: ${exitCode}`);
                }
            });
            // Wait for the server to be bound to the given port.
            yield waitForServer(port, timeout);
            return { port };
        });
    }
    exports.runServer = runServer;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvcHJvdHJhY3Rvci91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBRUgsK0NBQStDO0lBQy9DLDJCQUEyQjtJQUczQixTQUFnQixhQUFhLENBQUMsSUFBWTtRQUN4QyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNsQyxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0MsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBUEQsc0NBT0M7SUFFRCxTQUFnQixjQUFjLENBQUMsSUFBWTtRQUN6QyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMs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SSxFQUFDLENBQUM7UUFDaEIsQ0FBQztLQUFBO0lBckJELDhCQXFCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgY2hpbGRfcHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIG5ldCBmcm9tICduZXQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGNwUG9ydEZyZWUocG9ydDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3Qgc2VydmVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuICAgIHNlcnZlci5vbignZXJyb3InLCAoZSkgPT4geyByZXNvbHZlKGZhbHNlKTsgfSk7XG4gICAgc2VydmVyLm9uKCdjbG9zZScsICgpID0+IHsgcmVzb2x2ZSh0cnVlKTsgfSk7XG4gICAgc2VydmVyLmxpc3Rlbihwb3J0LCAoKSA9PiB7IHNlcnZlci5jbG9zZSgpOyB9KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1RjcFBvcnRCb3VuZChwb3J0OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBjbGllbnQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgIGNsaWVudC5vbmNlKCdjb25uZWN0JywgKCkgPT4geyByZXNvbHZlKHRydWUpOyB9KTtcbiAgICBjbGllbnQub25jZSgnZXJyb3InLCAoZSkgPT4geyByZXNvbHZlKGZhbHNlKTsgfSk7XG4gICAgY2xpZW50LmNvbm5lY3QocG9ydCk7XG4gIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZEZyZWVUY3BQb3J0KCk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IHJhbmdlID0ge1xuICAgIG1pbjogMzI3NjgsXG4gICAgbWF4OiA2MDAwMCxcbiAgfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDA7IGkrKykge1xuICAgIGxldCBwb3J0ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKHJhbmdlLm1heCAtIHJhbmdlLm1pbikgKyByYW5nZS5taW4pO1xuICAgIGlmIChhd2FpdCBpc1RjcFBvcnRGcmVlKHBvcnQpKSB7XG4gICAgICByZXR1cm4gcG9ydDtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBhIGZyZWUgcG9ydCcpO1xufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNvbmZpZyBwYXJhbWV0ZXIgb2YgdGhlIHByb3RyYWN0b3Jfd2ViX3Rlc3Rfc3VpdGUgb25QcmVwYXJlIGZ1bmN0aW9uXG5leHBvcnQgaW50ZXJmYWNlIE9uUHJlcGFyZUNvbmZpZyB7XG4gIC8vIFRoZSB3b3Jrc3BhY2UgbmFtZVxuICB3b3Jrc3BhY2U6IHN0cmluZztcblxuICAvLyBUaGUgc2VydmVyIGJpbmFyeSB0byBydW5cbiAgc2VydmVyOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yU2VydmVyKHBvcnQ6IG51bWJlciwgdGltZW91dDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHJldHVybiBpc1RjcFBvcnRCb3VuZChwb3J0KS50aGVuKGlzQm91bmQgPT4ge1xuICAgIGlmICghaXNCb3VuZCkge1xuICAgICAgaWYgKHRpbWVvdXQgPD0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RpbWVvdXQgd2FpdGluZyBmb3Igc2VydmVyIHRvIHN0YXJ0Jyk7XG4gICAgICB9XG4gICAgICBjb25zdCB3YWl0ID0gTWF0aC5taW4odGltZW91dCwgNTAwKTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHNldFRpbWVvdXQocmVzLCB3YWl0KSlcbiAgICAgICAgICAudGhlbigoKSA9PiB3YWl0Rm9yU2VydmVyKHBvcnQsIHRpbWVvdXQgLSB3YWl0KSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn1cblxuLy8gUmV0dXJuIHR5cGUgZnJvbSBydW5TZXJ2ZXIgZnVuY3Rpb25cbmV4cG9ydCBpbnRlcmZhY2UgU2VydmVyU3BlYyB7XG4gIC8vIFBvcnQgbnVtYmVyIHRoYXQgdGhlIHNlcnZlciBpcyBydW5uaW5nIG9uXG4gIHBvcnQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBSdW5zIHRoZSBzcGVjaWZpZWQgc2VydmVyIGJpbmFyeSBmcm9tIGEgZ2l2ZW4gd29ya3NwYWNlIGFuZCB3YWl0cyBmb3IgdGhlIHNlcnZlclxuICogYmVpbmcgcmVhZHkuIFRoZSBzZXJ2ZXIgYmluYXJ5IHdpbGwgYmUgcmVzb2x2ZWQgZnJvbSB0aGUgQmF6ZWwgcnVuZmlsZXMuIE5vdGUgdGhhdFxuICogdGhlIHNlcnZlciB3aWxsIGJlIGxhdW5jaGVkIHdpdGggYSByYW5kb20gZnJlZSBwb3J0IGluIG9yZGVyIHRvIHN1cHBvcnQgdGVzdCBjb25jdXJyZW5jeVxuICogd2l0aCBCYXplbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blNlcnZlcihcbiAgICB3b3Jrc3BhY2U6IHN0cmluZywgc2VydmVyVGFyZ2V0OiBzdHJpbmcsIHBvcnRGbGFnOiBzdHJpbmcsIHNlcnZlckFyZ3M6IHN0cmluZ1tdLFxuICAgIHRpbWVvdXQgPSA1MDAwKTogUHJvbWlzZTxTZXJ2ZXJTcGVjPiB7XG4gIGNvbnN0IHNlcnZlclBhdGggPSByZXF1aXJlLnJlc29sdmUoYCR7d29ya3NwYWNlfS8ke3NlcnZlclRhcmdldH1gKTtcbiAgY29uc3QgcG9ydCA9IGF3YWl0IGZpbmRGcmVlVGNwUG9ydCgpO1xuXG4gIC8vIFN0YXJ0IHRoZSBCYXplbCBzZXJ2ZXIgYmluYXJ5IHdpdGggYSByYW5kb20gZnJlZSBUQ1AgcG9ydC5cbiAgY29uc3Qgc2VydmVyUHJvY2VzcyA9IGNoaWxkX3Byb2Nlc3Muc3Bhd24oXG4gICAgICBzZXJ2ZXJQYXRoLCBzZXJ2ZXJBcmdzLmNvbmNhdChbcG9ydEZsYWcsIHBvcnQudG9TdHJpbmcoKV0pLCB7c3RkaW86ICdpbmhlcml0J30pO1xuXG4gIC8vIEluIGNhc2UgdGhlIHByb2Nlc3MgZXhpdGVkIHdpdGggYW4gZXJyb3IsIHdlIHdhbnQgdG8gcHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgc2VydmVyUHJvY2Vzcy5vbignZXhpdCcsIGV4aXRDb2RlID0+IHtcbiAgICBpZiAoZXhpdENvZGUgIT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGV4aXRlZCB3aXRoIGVycm9yIGNvZGU6ICR7ZXhpdENvZGV9YCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBXYWl0IGZvciB0aGUgc2VydmVyIHRvIGJlIGJvdW5kIHRvIHRoZSBnaXZlbiBwb3J0LlxuICBhd2FpdCB3YWl0Rm9yU2VydmVyKHBvcnQsIHRpbWVvdXQpO1xuXG4gIHJldHVybiB7cG9ydH07XG59XG4iXX0=