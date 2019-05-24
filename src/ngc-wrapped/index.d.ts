/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel" />
import * as ng from '@angular/compiler-cli';
import { BazelOptions } from '@bazel/typescript';
import * as ts from 'typescript';
export declare function main(args: any): 1 | 0;
export declare function runOneBuild(args: string[], inputs?: {
    [path: string]: string;
}): boolean;
export declare function relativeToRootDirs(filePath: string, rootDirs: string[]): string;
export declare function compile({ allDepsCompiledWithBazel, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics }: {
    allDepsCompiledWithBazel?: boolean;
    compilerOpts: ng.CompilerOptions;
    tsHost: ts.CompilerHost;
    inputs?: {
        [path: string]: string;
    };
    bazelOpts: BazelOptions;
    files: string[];
    expectedOuts: string[];
    gatherDiagnostics?: (program: ng.Program) => ng.Diagnostics;
}): {
    diagnostics: ng.Diagnostics;
    program: ng.Program;
};
