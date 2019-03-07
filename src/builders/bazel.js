/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/core/node", "child_process"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var core_1 = require("@angular-devkit/core");
    var node_1 = require("@angular-devkit/core/node");
    var child_process_1 = require("child_process");
    /**
     * Spawn the Bazel process. Trap SINGINT to make sure Bazel process is killed.
     */
    function runBazel(projectDir, binary, command, workspaceTarget, flags) {
        return new Promise(function (resolve, reject) {
            var buildProcess = child_process_1.spawn(core_1.getSystemPath(binary), tslib_1.__spread([command, workspaceTarget], flags), {
                cwd: core_1.getSystemPath(projectDir),
                stdio: 'inherit',
                shell: false,
            });
            process.on('SIGINT', function (signal) {
                if (!buildProcess.killed) {
                    buildProcess.kill();
                    reject(new Error("Bazel process received " + signal + "."));
                }
            });
            buildProcess.once('close', function (code) {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(core_1.basename(binary) + " failed with code " + code + "."));
                }
            });
        });
    }
    exports.runBazel = runBazel;
    /**
     * Resolves the path to `@bazel/bazel` or `@bazel/ibazel`.
     */
    function checkInstallation(name, projectDir) {
        var packageName = "@bazel/" + name;
        try {
            return node_1.resolve(packageName, {
                basedir: projectDir,
            });
        }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error("Could not run " + name + ". Please make sure that the " +
                    ("\"" + name + "\" command is installed by running ") +
                    ("\"npm install " + packageName + "\" or \"yarn install " + packageName + "\"."));
            }
            throw error;
        }
    }
    exports.checkInstallation = checkInstallation;
    /**
     * Returns the absolute path to the template directory in `@angular/bazel`.
     */
    function getTemplateDir(host, root) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var packageJson, packageDir, templateDir;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        packageJson = node_1.resolve('@angular/bazel', {
                            basedir: root,
                            resolvePackageJson: true,
                        });
                        packageDir = core_1.dirname(packageJson);
                        templateDir = core_1.join(packageDir, 'src', 'builders', 'files');
                        return [4 /*yield*/, host.isDirectory(templateDir).toPromise()];
                    case 1:
                        if (!(_a.sent())) {
                            throw new Error('Could not find Bazel template directory in "@angular/bazel".');
                        }
                        return [2 /*return*/, templateDir];
                }
            });
        });
    }
    exports.getTemplateDir = getTemplateDir;
    /**
     * Recursively list the specified 'dir' using depth-first approach. Paths
     * returned are relative to 'dir'.
     */
    function listR(host, dir) {
        function list(dir, root, results) {
            return tslib_1.__awaiter(this, void 0, void 0, function () {
                var e_1, _a, paths, paths_1, paths_1_1, path, absPath, relPath, e_1_1;
                return tslib_1.__generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, host.list(dir).toPromise()];
                        case 1:
                            paths = _b.sent();
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 9, 10, 11]);
                            paths_1 = tslib_1.__values(paths), paths_1_1 = paths_1.next();
                            _b.label = 3;
                        case 3:
                            if (!!paths_1_1.done) return [3 /*break*/, 8];
                            path = paths_1_1.value;
                            absPath = core_1.join(dir, path);
                            relPath = core_1.join(root, path);
                            return [4 /*yield*/, host.isFile(absPath).toPromise()];
                        case 4:
                            if (!_b.sent()) return [3 /*break*/, 5];
                            results.push(relPath);
                            return [3 /*break*/, 7];
                        case 5: return [4 /*yield*/, list(absPath, relPath, results)];
                        case 6:
                            _b.sent();
                            _b.label = 7;
                        case 7:
                            paths_1_1 = paths_1.next();
                            return [3 /*break*/, 3];
                        case 8: return [3 /*break*/, 11];
                        case 9:
                            e_1_1 = _b.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 11];
                        case 10:
                            try {
                                if (paths_1_1 && !paths_1_1.done && (_a = paths_1.return)) _a.call(paths_1);
                            }
                            finally { if (e_1) throw e_1.error; }
                            return [7 /*endfinally*/];
                        case 11: return [2 /*return*/, results];
                    }
                });
            });
        }
        return list(dir, '', []);
    }
    /**
     * Copy the file from 'source' to 'dest'.
     */
    function copyFile(host, source, dest) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var buffer;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, host.read(source).toPromise()];
                    case 1:
                        buffer = _a.sent();
                        return [4 /*yield*/, host.write(dest, buffer).toPromise()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Copy Bazel files (WORKSPACE, BUILD.bazel, etc) from the template directory to
     * the project `root` directory, and return the absolute paths of the files
     * copied, so that they can be deleted later.
     * Existing files in `root` will not be replaced.
     */
    function copyBazelFiles(host, root, templateDir) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var bazelFiles, templates;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bazelFiles = [];
                        return [4 /*yield*/, listR(host, templateDir)];
                    case 1:
                        templates = _a.sent();
                        return [4 /*yield*/, Promise.all(templates.map(function (template) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var name, source, dest, exists, _a;
                                return tslib_1.__generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            name = template.replace('__dot__', '.').replace('.template', '');
                                            source = core_1.join(templateDir, template);
                                            dest = core_1.join(root, name);
                                            _b.label = 1;
                                        case 1:
                                            _b.trys.push([1, 5, , 6]);
                                            return [4 /*yield*/, host.exists(dest).toPromise()];
                                        case 2:
                                            exists = _b.sent();
                                            if (!!exists) return [3 /*break*/, 4];
                                            return [4 /*yield*/, copyFile(host, source, dest)];
                                        case 3:
                                            _b.sent();
                                            bazelFiles.push(dest);
                                            _b.label = 4;
                                        case 4: return [3 /*break*/, 6];
                                        case 5:
                                            _a = _b.sent();
                                            return [3 /*break*/, 6];
                                        case 6: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, bazelFiles];
                }
            });
        });
    }
    exports.copyBazelFiles = copyBazelFiles;
    /**
     * Delete the specified 'files' and return a promise that always resolves.
     */
    function deleteBazelFiles(host, files) {
        var _this = this;
        return Promise.all(files.map(function (file) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var _a;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, host.delete(file).toPromise()];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }));
    }
    exports.deleteBazelFiles = deleteBazelFiles;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBRTdCLDZDQUFrRjtJQUNsRixrREFBa0Q7SUFFbEQsK0NBQW9DO0lBS3BDOztPQUVHO0lBQ0gsU0FBZ0IsUUFBUSxDQUNwQixVQUFnQixFQUFFLE1BQVksRUFBRSxPQUFnQixFQUFFLGVBQXVCLEVBQUUsS0FBZTtRQUM1RixPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDakMsSUFBTSxZQUFZLEdBQUcscUJBQUssQ0FBQyxvQkFBYSxDQUFDLE1BQU0sQ0FBQyxvQkFBRyxPQUFPLEVBQUUsZUFBZSxHQUFLLEtBQUssR0FBRztnQkFDdEYsR0FBRyxFQUFFLG9CQUFhLENBQUMsVUFBVSxDQUFDO2dCQUM5QixLQUFLLEVBQUUsU0FBUztnQkFDaEIsS0FBSyxFQUFFLEtBQUs7YUFDYixDQUFDLENBQUM7WUFFSCxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFDLE1BQU07Z0JBQzFCLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFO29CQUN4QixZQUFZLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3BCLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyw0QkFBMEIsTUFBTSxNQUFHLENBQUMsQ0FBQyxDQUFDO2lCQUN4RDtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBQyxJQUFZO2dCQUN0QyxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7b0JBQ2QsT0FBTyxFQUFFLENBQUM7aUJBQ1g7cUJBQU07b0JBQ0wsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFJLGVBQVEsQ0FBQyxNQUFNLENBQUMs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QU5DLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQU0sSUFBSTs7Ozs7O3dCQUVuQyxxQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFBOzt3QkFBbkMsU0FBbUMsQ0FBQzs7Ozs7Ozs7YUFHdkMsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBUEQsNENBT0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLyA8cmVmZXJlbmNlIHR5cGVzPSdub2RlJy8+XG5cbmltcG9ydCB7UGF0aCwgYmFzZW5hbWUsIGRpcm5hbWUsIGdldFN5c3RlbVBhdGgsIGpvaW59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7cmVzb2x2ZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQge0hvc3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlL3NyYy92aXJ0dWFsLWZzL2hvc3QnO1xuaW1wb3J0IHtzcGF3bn0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5cbmV4cG9ydCB0eXBlIEV4ZWN1dGFibGUgPSAnYmF6ZWwnIHwgJ2liYXplbCc7XG5leHBvcnQgdHlwZSBDb21tYW5kID0gJ2J1aWxkJyB8ICd0ZXN0JyB8ICdydW4nIHwgJ2NvdmVyYWdlJyB8ICdxdWVyeSc7XG5cbi8qKlxuICogU3Bhd24gdGhlIEJhemVsIHByb2Nlc3MuIFRyYXAgU0lOR0lOVCB0byBtYWtlIHN1cmUgQmF6ZWwgcHJvY2VzcyBpcyBraWxsZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBydW5CYXplbChcbiAgICBwcm9qZWN0RGlyOiBQYXRoLCBiaW5hcnk6IFBhdGgsIGNvbW1hbmQ6IENvbW1hbmQsIHdvcmtzcGFjZVRhcmdldDogc3RyaW5nLCBmbGFnczogc3RyaW5nW10pIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBidWlsZFByb2Nlc3MgPSBzcGF3bihnZXRTeXN0ZW1QYXRoKGJpbmFyeSksIFtjb21tYW5kLCB3b3Jrc3BhY2VUYXJnZXQsIC4uLmZsYWdzXSwge1xuICAgICAgY3dkOiBnZXRTeXN0ZW1QYXRoKHByb2plY3REaXIpLFxuICAgICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICAgIHNoZWxsOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIHByb2Nlc3Mub24oJ1NJR0lOVCcsIChzaWduYWwpID0+IHtcbiAgICAgIGlmICghYnVpbGRQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICBidWlsZFByb2Nlc3Mua2lsbCgpO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGBCYXplbCBwcm9jZXNzIHJlY2VpdmVkICR7c2lnbmFsfS5gKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBidWlsZFByb2Nlc3Mub25jZSgnY2xvc2UnLCAoY29kZTogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGAke2Jhc2VuYW1lKGJpbmFyeSl9IGZhaWxlZCB3aXRoIGNvZGUgJHtjb2RlfS5gKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIFJlc29sdmVzIHRoZSBwYXRoIHRvIGBAYmF6ZWwvYmF6ZWxgIG9yIGBAYmF6ZWwvaWJhemVsYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrSW5zdGFsbGF0aW9uKG5hbWU6IEV4ZWN1dGFibGUsIHByb2plY3REaXI6IFBhdGgpOiBzdHJpbmcge1xuICBjb25zdCBwYWNrYWdlTmFtZSA9IGBAYmF6ZWwvJHtuYW1lfWA7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlc29sdmUocGFja2FnZU5hbWUsIHtcbiAgICAgIGJhc2VkaXI6IHByb2plY3REaXIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcnVuICR7bmFtZX0uIFBsZWFzZSBtYWtlIHN1cmUgdGhhdCB0aGUgYCArXG4gICAgICAgICAgYFwiJHtuYW1lfVwiIGNvbW1hbmQgaXMgaW5zdGFsbGVkIGJ5IHJ1bm5pbmcgYCArXG4gICAgICAgICAgYFwibnBtIGluc3RhbGwgJHtwYWNrYWdlTmFtZX1cIiBvciBcInlhcm4gaW5zdGFsbCAke3BhY2thZ2VOYW1lfVwiLmApO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSBpbiBgQGFuZ3VsYXIvYmF6ZWxgLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VGVtcGxhdGVEaXIoaG9zdDogSG9zdCwgcm9vdDogUGF0aCk6IFByb21pc2U8UGF0aD4ge1xuICBjb25zdCBwYWNrYWdlSnNvbiA9IHJlc29sdmUoJ0Bhbmd1bGFyL2JhemVsJywge1xuICAgIGJhc2VkaXI6IHJvb3QsXG4gICAgcmVzb2x2ZVBhY2thZ2VKc29uOiB0cnVlLFxuICB9KTtcbiAgY29uc3QgcGFja2FnZURpciA9IGRpcm5hbWUocGFja2FnZUpzb24gYXMgUGF0aCk7XG4gIGNvbnN0IHRlbXBsYXRlRGlyID0gam9pbihwYWNrYWdlRGlyLCAnc3JjJywgJ2J1aWxkZXJzJywgJ2ZpbGVzJyk7XG4gIGlmICghYXdhaXQgaG9zdC5pc0RpcmVjdG9yeSh0ZW1wbGF0ZURpcikudG9Qcm9taXNlKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIEJhemVsIHRlbXBsYXRlIGRpcmVjdG9yeSBpbiBcIkBhbmd1bGFyL2JhemVsXCIuJyk7XG4gIH1cbiAgcmV0dXJuIHRlbXBsYXRlRGlyO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGxpc3QgdGhlIHNwZWNpZmllZCAnZGlyJyB1c2luZyBkZXB0aC1maXJzdCBhcHByb2FjaC4gUGF0aHNcbiAqIHJldHVybmVkIGFyZSByZWxhdGl2ZSB0byAnZGlyJy5cbiAqL1xuZnVuY3Rpb24gbGlzdFIoaG9zdDogSG9zdCwgZGlyOiBQYXRoKTogUHJvbWlzZTxQYXRoW10+IHtcbiAgYXN5bmMgZnVuY3Rpb24gbGlzdChkaXI6IFBhdGgsIHJvb3Q6IFBhdGgsIHJlc3VsdHM6IFBhdGhbXSkge1xuICAgIGNvbnN0IHBhdGhzID0gYXdhaXQgaG9zdC5saXN0KGRpcikudG9Qcm9taXNlKCk7XG4gICAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgICBjb25zdCBhYnNQYXRoID0gam9pbihkaXIsIHBhdGgpO1xuICAgICAgY29uc3QgcmVsUGF0aCA9IGpvaW4ocm9vdCwgcGF0aCk7XG4gICAgICBpZiAoYXdhaXQgaG9zdC5pc0ZpbGUoYWJzUGF0aCkudG9Qcm9taXNlKCkpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHJlbFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgbGlzdChhYnNQYXRoLCByZWxQYXRoLCByZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICByZXR1cm4gbGlzdChkaXIsICcnIGFzIFBhdGgsIFtdKTtcbn1cblxuLyoqXG4gKiBDb3B5IHRoZSBmaWxlIGZyb20gJ3NvdXJjZScgdG8gJ2Rlc3QnLlxuICovXG5hc3luYyBmdW5jdGlvbiBjb3B5RmlsZShob3N0OiBIb3N0LCBzb3VyY2U6IFBhdGgsIGRlc3Q6IFBhdGgpIHtcbiAgY29uc3QgYnVmZmVyID0gYXdhaXQgaG9zdC5yZWFkKHNvdXJjZSkudG9Qcm9taXNlKCk7XG4gIGF3YWl0IGhvc3Qud3JpdGUoZGVzdCwgYnVmZmVyKS50b1Byb21pc2UoKTtcbn1cblxuLyoqXG4gKiBDb3B5IEJhemVsIGZpbGVzIChXT1JLU1BBQ0UsIEJVSUxELmJhemVsLCBldGMpIGZyb20gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSB0b1xuICogdGhlIHByb2plY3QgYHJvb3RgIGRpcmVjdG9yeSwgYW5kIHJldHVybiB0aGUgYWJzb2x1dGUgcGF0aHMgb2YgdGhlIGZpbGVzXG4gKiBjb3BpZWQsIHNvIHRoYXQgdGhleSBjYW4gYmUgZGVsZXRlZCBsYXRlci5cbiAqIEV4aXN0aW5nIGZpbGVzIGluIGByb290YCB3aWxsIG5vdCBiZSByZXBsYWNlZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvcHlCYXplbEZpbGVzKGhvc3Q6IEhvc3QsIHJvb3Q6IFBhdGgsIHRlbXBsYXRlRGlyOiBQYXRoKSB7XG4gIGNvbnN0IGJhemVsRmlsZXM6IFBhdGhbXSA9IFtdO1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBhd2FpdCBsaXN0Uihob3N0LCB0ZW1wbGF0ZURpcik7XG5cbiAgYXdhaXQgUHJvbWlzZS5hbGwodGVtcGxhdGVzLm1hcChhc3luYyh0ZW1wbGF0ZSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSB0ZW1wbGF0ZS5yZXBsYWNlKCdfX2RvdF9fJywgJy4nKS5yZXBsYWNlKCcudGVtcGxhdGUnLCAnJyk7XG4gICAgY29uc3Qgc291cmNlID0gam9pbih0ZW1wbGF0ZURpciwgdGVtcGxhdGUpO1xuICAgIGNvbnN0IGRlc3QgPSBqb2luKHJvb3QsIG5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBob3N0LmV4aXN0cyhkZXN0KS50b1Byb21pc2UoKTtcbiAgICAgIGlmICghZXhpc3RzKSB7XG4gICAgICAgIGF3YWl0IGNvcHlGaWxlKGhvc3QsIHNvdXJjZSwgZGVzdCk7XG4gICAgICAgIGJhemVsRmlsZXMucHVzaChkZXN0KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH0pKTtcblxuICByZXR1cm4gYmF6ZWxGaWxlcztcbn1cblxuLyoqXG4gKiBEZWxldGUgdGhlIHNwZWNpZmllZCAnZmlsZXMnIGFuZCByZXR1cm4gYSBwcm9taXNlIHRoYXQgYWx3YXlzIHJlc29sdmVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlQmF6ZWxGaWxlcyhob3N0OiBIb3N0LCBmaWxlczogUGF0aFtdKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChmaWxlcy5tYXAoYXN5bmMoZmlsZSkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBob3N0LmRlbGV0ZShmaWxlKS50b1Byb21pc2UoKTtcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH0pKTtcbn1cbiJdfQ==