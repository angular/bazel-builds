/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <amd-module name="@angular/bazel/protractor-utils" />
export declare function isTcpPortFree(port: number): Promise<boolean>;
export declare function isTcpPortBound(port: number): Promise<boolean>;
export declare function findFreeTcpPort(): Promise<number>;
export interface OnPrepareConfig {
    workspace: string;
    server: string;
}
export declare function waitForServer(port: number, timeout: number): Promise<boolean>;
export interface ServerSpec {
    port: number;
}
/**
 * Runs the specified server binary from a given workspace and waits for the server
 * being ready. The server binary will be resolved from the Bazel runfiles. Note that
 * the server will be launched with a random free port in order to support test concurrency
 * with Bazel.
 */
export declare function runServer(workspace: string, serverTarget: string, portFlag: string, serverArgs: string[], timeout?: number): Promise<ServerSpec>;
