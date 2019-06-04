import path from 'path';
import pick from 'lodash.pick';
import omit from 'lodash.omit';
import isUndefined from 'lodash.isundefined';
import { FileSystem } from 'zos-lib';

interface NetworkConfig extends Config {
  artifactDefaults: ArtifactDefaults;
  network: Network;
}

interface Config {
  networks: { [network: string]: Network };
  provider: Provider;
  buildDir: string;
  // TODO: remove after managing compiler info in zos.json
  compilers?: CompilersInfo;
}

interface NetworkCamelCase<T> {
  networkId: T;
}

interface NetworkSnakeCase<T> {
  network_id: T;
}

type NetworkId<T> =
  | NetworkCamelCase<T>
  | NetworkSnakeCase<T>
  | (NetworkCamelCase<T> & NetworkSnakeCase<T>);

type Network = {
  host: string;
  port: number | string;
  protocol?: string;
  from?: number | string;
  gas?: number | string;
  gasPrice?: number | string;
  provider?: string | ((any) => any);
} & NetworkId<string | number>;

interface ArtifactDefaults {
  from?: number | string;
  gas?: number | string;
  gasPrice?: number | string;
}

type Provider = string | ((any) => any);
// TODO: remove after managing compiler info in zos.json
type CompilersInfo = any;

const ZosConfig = {
  name: 'ZosConfig',

  initialize(root: string = process.cwd()): void {
    this.createContractsDir(root);
    this.createZosConfigFile(root);
  },

  exists(root: string = process.cwd()): boolean {
    return FileSystem.exists(`${root}/networks.js`);
  },

  getConfig(root: string = process.cwd()): Config {
    const zosConfigFile = require(`${root}/networks.js`);
    const compilers =
      zosConfigFile.compilers || this.getDefaultCompilersProperties();
    const buildDir = `${root}/build/contracts`;

    return { ...zosConfigFile, compilers, buildDir };
  },

  getBuildDir(): string {
    return `${process.cwd()}/build/contracts`;
  },

  loadNetworkConfig(
    networkName: string,
    root: string = process.cwd(),
  ): NetworkConfig {
    const config = this.getConfig(root);
    const { networks } = config;
    if (!networks[networkName])
      throw Error(
        `Given network '${networkName}' is not defined in your networks.js file`,
      );

    const network = networks[networkName];
    const provider = this.getProvider(networks[networkName]);
    const artifactDefaults = this.getArtifactDefaults(
      config,
      networks[networkName],
    );

    return {
      ...config,
      network,
      provider,
      artifactDefaults,
    };
  },

  getProvider(network: any): Provider {
    let { provider } = network;

    if (!provider) {
      const { host, port, protocol } = network;
      if (!host) throw Error('A host name must be specified');
      if (!port) throw Error('A port must be specified');
      provider = `${protocol ? protocol : 'http'}://${host}:${port}`;
    } else if (typeof provider === 'function') {
      provider = provider();
    }

    return provider;
  },

  getArtifactDefaults(
    zosConfigFile: Config,
    network: Network,
  ): ArtifactDefaults {
    const defaults = ['gas', 'gasPrice', 'from'];
    const configDefaults = omit(pick(zosConfigFile, defaults), isUndefined);
    const networkDefaults = omit(pick(network, defaults), isUndefined);

    return { ...configDefaults, ...networkDefaults };
  },

  getDefaultCompilersProperties(): CompilersInfo {
    return {
      vyper: {},
      solc: {
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
        },
      },
    };
  },

  createContractsDir(root: string): void {
    const contractsDir = `${root}/contracts`;
    this.createDir(contractsDir);
  },

  createZosConfigFile(root: string): void {
    if (!this.exists(root)) {
      const blueprint = path.resolve(__dirname, './blueprint.networks.js');
      FileSystem.copy(blueprint, `${root}/networks.js`);
    }
  },

  createDir(dir: string): void {
    if (!FileSystem.exists(dir)) {
      FileSystem.createDir(dir);
      FileSystem.write(`${dir}/.gitkeep`, '');
    }
  },
};

export default ZosConfig;
