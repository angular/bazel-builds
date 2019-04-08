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
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "@angular-devkit/architect/src/index2", "@angular-devkit/core", "@angular/bazel/src/builders/bazel", "@angular-devkit/core/node"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var index2_1 = require("@angular-devkit/architect/src/index2");
    var core_1 = require("@angular-devkit/core");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    var node_1 = require("@angular-devkit/core/node");
    function _bazelBuilder(options, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var root, logger, bazelCommand, leaveBazelFilesOnDisk, targetLabel, watch, executable, binary, host, templateDir, bazelFiles, flags, err_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        root = core_1.normalize(context.workspaceRoot);
                        logger = context.logger;
                        bazelCommand = options.bazelCommand, leaveBazelFilesOnDisk = options.leaveBazelFilesOnDisk, targetLabel = options.targetLabel, watch = options.watch;
                        executable = watch ? 'ibazel' : 'bazel';
                        binary = bazel_1.checkInstallation(executable, root);
                        host = new node_1.NodeJsSyncHost();
                        return [4 /*yield*/, bazel_1.getTemplateDir(host, root)];
                    case 1:
                        templateDir = _a.sent();
                        return [4 /*yield*/, bazel_1.copyBazelFiles(host, root, templateDir)];
                    case 2:
                        bazelFiles = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, 6, 9]);
                        flags = [];
                        return [4 /*yield*/, bazel_1.runBazel(root, binary, bazelCommand, targetLabel, flags)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 5:
                        err_1 = _a.sent();
                        logger.error(err_1.message);
                        return [2 /*return*/, { success: false }];
                    case 6:
                        if (!!leaveBazelFilesOnDisk) return [3 /*break*/, 8];
                        return [4 /*yield*/, bazel_1.deleteBazelFiles(host, bazelFiles)];
                    case 7:
                        _a.sent(); // this will never throw
                        _a.label = 8;
                    case 8: return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    }
    exports.default = index2_1.createBuilder(_bazelBuilder);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwrREFBbUc7SUFDbkcsNkNBQTJEO0lBQzNELDJEQUFzRztJQUV0RyxrREFBeUQ7SUFFekQsU0FBZSxhQUFhLENBQUMsT0FBNEIsRUFBRSxPQUF1Qjs7Ozs7O3dCQUV0RSxJQUFJLEdBQUcsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQ3ZDLE1BQU0sR0FBSSxPQUFPLE9BQVgsQ0FBWTt3QkFDbEIsWUFBWSxHQUErQyxPQUFPLGFBQXRELEVBQUUscUJBQXFCLEdBQXdCLE9BQU8sc0JBQS9CLEVBQUUsV0FBVyxHQUFXLE9BQU8sWUFBbEIsRUFBRSxLQUFLLEdBQUksT0FBTyxNQUFYLENBQVk7d0JBQ3BFLFVBQVUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO3dCQUN4QyxNQUFNLEdBQUcseUJBQWlCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUU3QyxJQUFJLEdBQUcsSUFBSSxxQkFBYyxFQUFFLENBQUM7d0JBQ2QscUJBQU0sc0JBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUE7O3dCQUE5QyxXQUFXLEdBQUcsU0FBZ0M7d0JBQ2pDLHFCQUFNLHNCQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsRUFBQTs7d0JBQTFELFVBQVUsR0FBRyxTQUE2Qzs7Ozt3QkFHeEQsS0FBSyxHQUFhLEVBQUUsQ0FBQzt3QkFDM0IscUJBQU0sZ0JBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUE7O3dCQUE5RCxTQUE4RCxDQUFDO3dCQUMvRCxzQkFBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsRUFBQzs7O3dCQUV2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDMUIsc0JBQU8sRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLEVBQUM7OzZCQUVwQixDQUFDLHFCQUFxQixFQUF0Qix3QkFBc0I7d0JBQ3hCLHFCQUFNLHdCQUFnQixDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBQTs7d0JBQXhDLFNBQXdDLENBQUMsQ0FBRSx3QkFBd0I7Ozs7Ozs7S0FHeEU7SUFFTCxrQkFBZSxzQkFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEJhemVsIGJ1aWxkZXJcbiAqL1xuXG5pbXBvcnQge0J1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyLH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7SnNvbk9iamVjdCwgbm9ybWFsaXplfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge2NoZWNrSW5zdGFsbGF0aW9uLCBjb3B5QmF6ZWxGaWxlcywgZGVsZXRlQmF6ZWxGaWxlcywgZ2V0VGVtcGxhdGVEaXIsIHJ1bkJhemVsfSBmcm9tICcuL2JhemVsJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQge05vZGVKc1N5bmNIb3N0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZS9ub2RlJztcblxuYXN5bmMgZnVuY3Rpb24gX2JhemVsQnVpbGRlcihvcHRpb25zOiBKc29uT2JqZWN0ICYgU2NoZW1hLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCwgKTpcbiAgICBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgICAgIGNvbnN0IHJvb3QgPSBub3JtYWxpemUoY29udGV4dC53b3Jrc3BhY2VSb290KTtcbiAgICAgIGNvbnN0IHtsb2dnZXJ9ID0gY29udGV4dDtcbiAgICAgIGNvbnN0IHtiYXplbENvbW1hbmQsIGxlYXZlQmF6ZWxGaWxlc09uRGlzaywgdGFyZ2V0TGFiZWwsIHdhdGNofSA9IG9wdGlvbnM7XG4gICAgICBjb25zdCBleGVjdXRhYmxlID0gd2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG4gICAgICBjb25zdCBiaW5hcnkgPSBjaGVja0luc3RhbGxhdGlvbihleGVjdXRhYmxlLCByb290KTtcblxuICAgICAgY29uc3QgaG9zdCA9IG5ldyBOb2RlSnNTeW5jSG9zdCgpO1xuICAgICAgY29uc3QgdGVtcGxhdGVEaXIgPSBhd2FpdCBnZXRUZW1wbGF0ZURpcihob3N0LCByb290KTtcbiAgICAgIGNvbnN0IGJhemVsRmlsZXMgPSBhd2FpdCBjb3B5QmF6ZWxGaWxlcyhob3N0LCByb290LCB0ZW1wbGF0ZURpcik7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBhd2FpdCBydW5CYXplbChyb290LCBiaW5hcnksIGJhemVsQ29tbWFuZCwgdGFyZ2V0TGFiZWwsIGZsYWdzKTtcbiAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlfTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IGZhbHNlfTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmICghbGVhdmVCYXplbEZpbGVzT25EaXNrKSB7XG4gICAgICAgICAgYXdhaXQgZGVsZXRlQmF6ZWxGaWxlcyhob3N0LCBiYXplbEZpbGVzKTsgIC8vIHRoaXMgd2lsbCBuZXZlciB0aHJvd1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKF9iYXplbEJ1aWxkZXIpO1xuIl19