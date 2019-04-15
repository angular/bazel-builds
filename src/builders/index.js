/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel builder
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "@angular-devkit/architect/src/index2", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var index2_1 = require("@angular-devkit/architect/src/index2");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    function _bazelBuilder(options, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var logger, workspaceRoot, bazelCommand, leaveBazelFilesOnDisk, targetLabel, watch, executable, binary, templateDir, bazelFiles, flags, err_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger = context.logger, workspaceRoot = context.workspaceRoot;
                        bazelCommand = options.bazelCommand, leaveBazelFilesOnDisk = options.leaveBazelFilesOnDisk, targetLabel = options.targetLabel, watch = options.watch;
                        executable = watch ? 'ibazel' : 'bazel';
                        binary = bazel_1.checkInstallation(executable, workspaceRoot);
                        templateDir = bazel_1.getTemplateDir(workspaceRoot);
                        bazelFiles = bazel_1.copyBazelFiles(workspaceRoot, templateDir);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        flags = [];
                        return [4 /*yield*/, bazel_1.runBazel(workspaceRoot, binary, bazelCommand, targetLabel, flags)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 3:
                        err_1 = _a.sent();
                        logger.error(err_1.message);
                        return [2 /*return*/, { success: false }];
                    case 4:
                        if (!leaveBazelFilesOnDisk) {
                            bazel_1.deleteBazelFiles(bazelFiles); // this will never throw
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    exports.default = index2_1.createBuilder(_bazelBuilder);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwrREFBbUc7SUFFbkcsMkRBQXNHO0lBR3RHLFNBQWUsYUFBYSxDQUFDLE9BQTRCLEVBQUUsT0FBdUI7Ozs7Ozt3QkFFckUsTUFBTSxHQUFtQixPQUFPLE9BQTFCLEVBQUUsYUFBYSxHQUFJLE9BQU8sY0FBWCxDQUFZO3dCQUNqQyxZQUFZLEdBQStDLE9BQU8sYUFBdEQsRUFBRSxxQkFBcUIsR0FBd0IsT0FBTyxzQkFBL0IsRUFBRSxXQUFXLEdBQVcsT0FBTyxZQUFsQixFQUFFLEtBQUssR0FBSSxPQUFPLE1BQVgsQ0FBWTt3QkFDcEUsVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7d0JBQ3hDLE1BQU0sR0FBRyx5QkFBaUIsQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7d0JBQ3RELFdBQVcsR0FBRyxzQkFBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDO3dCQUM1QyxVQUFVLEdBQUcsc0JBQWMsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7Ozs7d0JBR3RELEtBQUssR0FBYSxFQUFFLENBQUM7d0JBQzNCLHFCQUFNLGdCQUFRLENBQUMsYUFBYSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxFQUFBOzt3QkFBdkUsU0FBdUUsQ0FBQzt3QkFDeEUsc0JBQU8sRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLEVBQUM7Ozt3QkFFdkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQzFCLHNCQUFPLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBQyxFQUFDOzt3QkFFeEIsSUFBSSxDQUFDLHFCQUFxQixFQUFFOzRCQUMxQix3QkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFFLHdCQUF3Qjt5QkFDeEQ7Ozs7OztLQUVKO0lBRUwsa0JBQWUsc0JBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBCYXplbCBidWlsZGVyXG4gKi9cblxuaW1wb3J0IHtCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlcix9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvc3JjL2luZGV4Mic7XG5pbXBvcnQge0pzb25PYmplY3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7Y2hlY2tJbnN0YWxsYXRpb24sIGNvcHlCYXplbEZpbGVzLCBkZWxldGVCYXplbEZpbGVzLCBnZXRUZW1wbGF0ZURpciwgcnVuQmF6ZWx9IGZyb20gJy4vYmF6ZWwnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuYXN5bmMgZnVuY3Rpb24gX2JhemVsQnVpbGRlcihvcHRpb25zOiBKc29uT2JqZWN0ICYgU2NoZW1hLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCwgKTpcbiAgICBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgICAgIGNvbnN0IHtsb2dnZXIsIHdvcmtzcGFjZVJvb3R9ID0gY29udGV4dDtcbiAgICAgIGNvbnN0IHtiYXplbENvbW1hbmQsIGxlYXZlQmF6ZWxGaWxlc09uRGlzaywgdGFyZ2V0TGFiZWwsIHdhdGNofSA9IG9wdGlvbnM7XG4gICAgICBjb25zdCBleGVjdXRhYmxlID0gd2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG4gICAgICBjb25zdCBiaW5hcnkgPSBjaGVja0luc3RhbGxhdGlvbihleGVjdXRhYmxlLCB3b3Jrc3BhY2VSb290KTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlRGlyID0gZ2V0VGVtcGxhdGVEaXIod29ya3NwYWNlUm9vdCk7XG4gICAgICBjb25zdCBiYXplbEZpbGVzID0gY29weUJhemVsRmlsZXMod29ya3NwYWNlUm9vdCwgdGVtcGxhdGVEaXIpO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmbGFnczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgYXdhaXQgcnVuQmF6ZWwod29ya3NwYWNlUm9vdCwgYmluYXJ5LCBiYXplbENvbW1hbmQsIHRhcmdldExhYmVsLCBmbGFncyk7XG4gICAgICAgIHJldHVybiB7c3VjY2VzczogdHJ1ZX07XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiBmYWxzZX07XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBpZiAoIWxlYXZlQmF6ZWxGaWxlc09uRGlzaykge1xuICAgICAgICAgIGRlbGV0ZUJhemVsRmlsZXMoYmF6ZWxGaWxlcyk7ICAvLyB0aGlzIHdpbGwgbmV2ZXIgdGhyb3dcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihfYmF6ZWxCdWlsZGVyKTtcbiJdfQ==