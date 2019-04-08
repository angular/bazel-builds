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
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "@angular-devkit/core", "child_process", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var core_1 = require("@angular-devkit/core");
    var child_process_1 = require("child_process");
    var path = require("path");
    /**
     * Spawn the Bazel process. Trap SINGINT to make sure Bazel process is killed.
     */
    function runBazel(projectDir, binary, command, workspaceTarget, flags) {
        return new Promise(function (resolve, reject) {
            var buildProcess = child_process_1.spawn(process.argv[0], tslib_1.__spread([binary, command, workspaceTarget], flags), {
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
                    reject(new Error(binary + " failed with code " + code + "."));
                }
            });
        });
    }
    exports.runBazel = runBazel;
    /**
     * Resolves the path to `@bazel/bazel` or `@bazel/ibazel`.
     */
    function checkInstallation(name, projectDir) {
        var packageName = "@bazel/" + name + "/package.json";
        try {
            var bazelPath = require.resolve(packageName, {
                paths: [core_1.getSystemPath(projectDir)],
            });
            return path.dirname(bazelPath);
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
                        packageJson = require.resolve('@angular/bazel/package.json', {
                            paths: [core_1.getSystemPath(root)],
                        });
                        packageDir = core_1.dirname(core_1.normalize(packageJson));
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
                var e_1, _a, paths, paths_1, paths_1_1, path_1, absPath, relPath, e_1_1;
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
                            path_1 = paths_1_1.value;
                            absPath = core_1.join(dir, path_1);
                            relPath = core_1.join(root, path_1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBRTdCLDZDQUFtRjtJQUVuRiwrQ0FBb0M7SUFDcEMsMkJBQTZCO0lBSzdCOztPQUVHO0lBQ0gsU0FBZ0IsUUFBUSxDQUNwQixVQUFnQixFQUFFLE1BQWMsRUFBRSxPQUFnQixFQUFFLGVBQXVCLEVBQUUsS0FBZTtRQUM5RixPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDakMsSUFBTSxZQUFZLEdBQUcscUJBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxvQkFBRyxNQUFNLEVBQUUsT0FBTyxFQUFFLGVBQWUsR0FBSyxLQUFLLEdBQUc7Z0JBQ3hGLEdBQUcsRUFBRSxvQkFBYSxDQUFDLFVBQVUsQ0FBQztnQkFDOUIsS0FBSyxFQUFFLFNBQVM7Z0JBQ2hCLEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBQyxNQUFNO2dCQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRTtvQkFDeEIsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNwQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsNEJBQTBCLE1BQU0sTUFBRyxDQUFDLENBQUMsQ0FBQztpQkFDeEQ7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsSUFBWTtnQkFDdEMsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO29CQUNkLE9BQU8sRUFBRSxDQUFDO2lCQUNYO3FCQUFNO29CQUNMLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBSSxN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RUFBQTs7d0JBWkgsU0FZRyxDQUFDO3dCQUVKLHNCQUFPLFVBQVUsRUFBQzs7OztLQUNuQjtJQW5CRCx3Q0FtQkM7SUFFRDs7T0FFRztJQUNILFNBQWdCLGdCQUFnQixDQUFDLElBQVUsRUFBRSxLQUFhO1FBQTFELGlCQU9DO1FBTkMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBTSxJQUFJOzs7Ozs7d0JBRW5DLHFCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUE7O3dCQUFuQyxTQUFtQyxDQUFDOzs7Ozs7OzthQUd2QyxDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7SUFQRCw0Q0FPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9J25vZGUnLz5cblxuaW1wb3J0IHtQYXRoLCBkaXJuYW1lLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCBub3JtYWxpemV9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7SG9zdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvc3JjL3ZpcnR1YWwtZnMvaG9zdCc7XG5pbXBvcnQge3NwYXdufSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCB0eXBlIEV4ZWN1dGFibGUgPSAnYmF6ZWwnIHwgJ2liYXplbCc7XG5leHBvcnQgdHlwZSBDb21tYW5kID0gJ2J1aWxkJyB8ICd0ZXN0JyB8ICdydW4nIHwgJ2NvdmVyYWdlJyB8ICdxdWVyeSc7XG5cbi8qKlxuICogU3Bhd24gdGhlIEJhemVsIHByb2Nlc3MuIFRyYXAgU0lOR0lOVCB0byBtYWtlIHN1cmUgQmF6ZWwgcHJvY2VzcyBpcyBraWxsZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBydW5CYXplbChcbiAgICBwcm9qZWN0RGlyOiBQYXRoLCBiaW5hcnk6IHN0cmluZywgY29tbWFuZDogQ29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0OiBzdHJpbmcsIGZsYWdzOiBzdHJpbmdbXSkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGJ1aWxkUHJvY2VzcyA9IHNwYXduKHByb2Nlc3MuYXJndlswXSwgW2JpbmFyeSwgY29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0LCAuLi5mbGFnc10sIHtcbiAgICAgIGN3ZDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0RGlyKSxcbiAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgICBzaGVsbDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBwcm9jZXNzLm9uKCdTSUdJTlQnLCAoc2lnbmFsKSA9PiB7XG4gICAgICBpZiAoIWJ1aWxkUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgYnVpbGRQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgQmF6ZWwgcHJvY2VzcyByZWNlaXZlZCAke3NpZ25hbH0uYCkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYnVpbGRQcm9jZXNzLm9uY2UoJ2Nsb3NlJywgKGNvZGU6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKGNvZGUgPT09IDApIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgJHtiaW5hcnl9IGZhaWxlZCB3aXRoIGNvZGUgJHtjb2RlfS5gKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIFJlc29sdmVzIHRoZSBwYXRoIHRvIGBAYmF6ZWwvYmF6ZWxgIG9yIGBAYmF6ZWwvaWJhemVsYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrSW5zdGFsbGF0aW9uKG5hbWU6IEV4ZWN1dGFibGUsIHByb2plY3REaXI6IFBhdGgpOiBzdHJpbmcge1xuICBjb25zdCBwYWNrYWdlTmFtZSA9IGBAYmF6ZWwvJHtuYW1lfS9wYWNrYWdlLmpzb25gO1xuICB0cnkge1xuICAgIGNvbnN0IGJhemVsUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShwYWNrYWdlTmFtZSwge1xuICAgICAgcGF0aHM6IFtnZXRTeXN0ZW1QYXRoKHByb2plY3REaXIpXSxcbiAgICB9KTtcblxuICAgIHJldHVybiBwYXRoLmRpcm5hbWUoYmF6ZWxQYXRoKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSA9PT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENvdWxkIG5vdCBydW4gJHtuYW1lfS4gUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHRoZSBgICtcbiAgICAgICAgICBgXCIke25hbWV9XCIgY29tbWFuZCBpcyBpbnN0YWxsZWQgYnkgcnVubmluZyBgICtcbiAgICAgICAgICBgXCJucG0gaW5zdGFsbCAke3BhY2thZ2VOYW1lfVwiIG9yIFwieWFybiBpbnN0YWxsICR7cGFja2FnZU5hbWV9XCIuYCk7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgdGVtcGxhdGUgZGlyZWN0b3J5IGluIGBAYW5ndWxhci9iYXplbGAuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUZW1wbGF0ZURpcihob3N0OiBIb3N0LCByb290OiBQYXRoKTogUHJvbWlzZTxQYXRoPiB7XG4gIGNvbnN0IHBhY2thZ2VKc29uID0gcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9iYXplbC9wYWNrYWdlLmpzb24nLCB7XG4gICAgcGF0aHM6IFtnZXRTeXN0ZW1QYXRoKHJvb3QpXSxcbiAgfSk7XG5cbiAgY29uc3QgcGFja2FnZURpciA9IGRpcm5hbWUobm9ybWFsaXplKHBhY2thZ2VKc29uKSk7XG4gIGNvbnN0IHRlbXBsYXRlRGlyID0gam9pbihwYWNrYWdlRGlyLCAnc3JjJywgJ2J1aWxkZXJzJywgJ2ZpbGVzJyk7XG4gIGlmICghYXdhaXQgaG9zdC5pc0RpcmVjdG9yeSh0ZW1wbGF0ZURpcikudG9Qcm9taXNlKCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIEJhemVsIHRlbXBsYXRlIGRpcmVjdG9yeSBpbiBcIkBhbmd1bGFyL2JhemVsXCIuJyk7XG4gIH1cbiAgcmV0dXJuIHRlbXBsYXRlRGlyO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGxpc3QgdGhlIHNwZWNpZmllZCAnZGlyJyB1c2luZyBkZXB0aC1maXJzdCBhcHByb2FjaC4gUGF0aHNcbiAqIHJldHVybmVkIGFyZSByZWxhdGl2ZSB0byAnZGlyJy5cbiAqL1xuZnVuY3Rpb24gbGlzdFIoaG9zdDogSG9zdCwgZGlyOiBQYXRoKTogUHJvbWlzZTxQYXRoW10+IHtcbiAgYXN5bmMgZnVuY3Rpb24gbGlzdChkaXI6IFBhdGgsIHJvb3Q6IFBhdGgsIHJlc3VsdHM6IFBhdGhbXSkge1xuICAgIGNvbnN0IHBhdGhzID0gYXdhaXQgaG9zdC5saXN0KGRpcikudG9Qcm9taXNlKCk7XG4gICAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgICBjb25zdCBhYnNQYXRoID0gam9pbihkaXIsIHBhdGgpO1xuICAgICAgY29uc3QgcmVsUGF0aCA9IGpvaW4ocm9vdCwgcGF0aCk7XG4gICAgICBpZiAoYXdhaXQgaG9zdC5pc0ZpbGUoYWJzUGF0aCkudG9Qcm9taXNlKCkpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHJlbFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgbGlzdChhYnNQYXRoLCByZWxQYXRoLCByZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICByZXR1cm4gbGlzdChkaXIsICcnIGFzIFBhdGgsIFtdKTtcbn1cblxuLyoqXG4gKiBDb3B5IHRoZSBmaWxlIGZyb20gJ3NvdXJjZScgdG8gJ2Rlc3QnLlxuICovXG5hc3luYyBmdW5jdGlvbiBjb3B5RmlsZShob3N0OiBIb3N0LCBzb3VyY2U6IFBhdGgsIGRlc3Q6IFBhdGgpIHtcbiAgY29uc3QgYnVmZmVyID0gYXdhaXQgaG9zdC5yZWFkKHNvdXJjZSkudG9Qcm9taXNlKCk7XG4gIGF3YWl0IGhvc3Qud3JpdGUoZGVzdCwgYnVmZmVyKS50b1Byb21pc2UoKTtcbn1cblxuLyoqXG4gKiBDb3B5IEJhemVsIGZpbGVzIChXT1JLU1BBQ0UsIEJVSUxELmJhemVsLCBldGMpIGZyb20gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSB0b1xuICogdGhlIHByb2plY3QgYHJvb3RgIGRpcmVjdG9yeSwgYW5kIHJldHVybiB0aGUgYWJzb2x1dGUgcGF0aHMgb2YgdGhlIGZpbGVzXG4gKiBjb3BpZWQsIHNvIHRoYXQgdGhleSBjYW4gYmUgZGVsZXRlZCBsYXRlci5cbiAqIEV4aXN0aW5nIGZpbGVzIGluIGByb290YCB3aWxsIG5vdCBiZSByZXBsYWNlZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvcHlCYXplbEZpbGVzKGhvc3Q6IEhvc3QsIHJvb3Q6IFBhdGgsIHRlbXBsYXRlRGlyOiBQYXRoKSB7XG4gIGNvbnN0IGJhemVsRmlsZXM6IFBhdGhbXSA9IFtdO1xuICBjb25zdCB0ZW1wbGF0ZXMgPSBhd2FpdCBsaXN0Uihob3N0LCB0ZW1wbGF0ZURpcik7XG5cbiAgYXdhaXQgUHJvbWlzZS5hbGwodGVtcGxhdGVzLm1hcChhc3luYyh0ZW1wbGF0ZSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSB0ZW1wbGF0ZS5yZXBsYWNlKCdfX2RvdF9fJywgJy4nKS5yZXBsYWNlKCcudGVtcGxhdGUnLCAnJyk7XG4gICAgY29uc3Qgc291cmNlID0gam9pbih0ZW1wbGF0ZURpciwgdGVtcGxhdGUpO1xuICAgIGNvbnN0IGRlc3QgPSBqb2luKHJvb3QsIG5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBob3N0LmV4aXN0cyhkZXN0KS50b1Byb21pc2UoKTtcbiAgICAgIGlmICghZXhpc3RzKSB7XG4gICAgICAgIGF3YWl0IGNvcHlGaWxlKGhvc3QsIHNvdXJjZSwgZGVzdCk7XG4gICAgICAgIGJhemVsRmlsZXMucHVzaChkZXN0KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH0pKTtcblxuICByZXR1cm4gYmF6ZWxGaWxlcztcbn1cblxuLyoqXG4gKiBEZWxldGUgdGhlIHNwZWNpZmllZCAnZmlsZXMnIGFuZCByZXR1cm4gYSBwcm9taXNlIHRoYXQgYWx3YXlzIHJlc29sdmVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlQmF6ZWxGaWxlcyhob3N0OiBIb3N0LCBmaWxlczogUGF0aFtdKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChmaWxlcy5tYXAoYXN5bmMoZmlsZSkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBob3N0LmRlbGV0ZShmaWxlKS50b1Byb21pc2UoKTtcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH0pKTtcbn1cbiJdfQ==