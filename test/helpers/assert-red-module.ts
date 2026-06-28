import { expect } from "vitest";

type FutureModuleNamespace = {
  readonly [exportName: string]: unknown;
};

export class RedModuleMissingError extends Error {
  override readonly name = "RedModuleMissingError";

  constructor(readonly modulePath: string, options?: ErrorOptions) {
    super(`RED: expected future module '${modulePath}' to exist, but import failed. Implement production code only after this RED test is committed.`, options);
  }
}

export class RedExportMissingError extends Error {
  override readonly name = "RedExportMissingError";

  constructor(
    readonly modulePath: string,
    readonly exportName: string,
  ) {
    super(`RED: expected future module '${modulePath}' to export '${exportName}', but it was missing.`);
  }
}

export class RedModuleNotImplementedError extends Error {
  override readonly name = "RedModuleNotImplementedError";

  constructor(readonly implementationPath: string, options?: ErrorOptions) {
    super(`RED: ${implementationPath} is not implemented`, options);
  }
}

export async function importFutureModule(modulePath: string): Promise<FutureModuleNamespace> {
  try {
    const moduleNamespace: unknown = await import(modulePath);

    if (isFutureModuleNamespace(moduleNamespace)) {
      return moduleNamespace;
    }

    throw new RedModuleMissingError(modulePath);
  } catch (error) {
    if (error instanceof RedModuleMissingError) {
      throw error;
    }

    if (error instanceof Error && isMissingModuleError(error, modulePath)) {
      throw new RedModuleMissingError(modulePath, { cause: error });
    }

    throw error;
  }
}

export async function expectFutureModule(modulePath: string): Promise<FutureModuleNamespace> {
  try {
    return await importFutureModule(modulePath);
  } catch (error) {
    if (error instanceof RedModuleMissingError) {
      expect.fail(error.message);
    }

    throw error;
  }
}

export async function expectFutureExport(modulePath: string, exportName: string): Promise<unknown> {
  const moduleNamespace = await expectFutureModule(modulePath);

  if (exportName in moduleNamespace) {
    return moduleNamespace[exportName];
  }

  expect.fail(new RedExportMissingError(modulePath, exportName).message);
}

export async function expectNotImplementedModule(modulePath: string, implementationPath: string): Promise<FutureModuleNamespace> {
  try {
    return await importFutureModule(modulePath);
  } catch (error) {
    if (error instanceof RedModuleMissingError) {
      expect.fail(new RedModuleNotImplementedError(implementationPath, { cause: error }).message);
    }

    throw error;
  }
}

export async function expectNotImplementedExport(
  modulePath: string,
  implementationPath: string,
  exportName: string,
): Promise<unknown> {
  const moduleNamespace = await expectNotImplementedModule(modulePath, implementationPath);

  if (exportName in moduleNamespace) {
    return moduleNamespace[exportName];
  }

  expect.fail(new RedExportMissingError(modulePath, exportName).message);
}

function isFutureModuleNamespace(value: unknown): value is FutureModuleNamespace {
  return typeof value === "object" && value !== null;
}

function isMissingModuleError(error: Error, modulePath: string): boolean {
  const hasMissingModuleCode = "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
  const messageNamesModule = error.message.includes(modulePath) || error.message.includes("Cannot find module");

  return hasMissingModuleCode || messageNamesModule;
}
