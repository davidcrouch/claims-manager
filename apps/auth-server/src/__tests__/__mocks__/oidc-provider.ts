export class Provider {
  constructor(issuer: string, config: any) {
    this.issuer = issuer;
    this.configuration = config;
  }

  issuer: string;
  configuration: any;

  async callback() {
    return jest.fn();
  }

  async interactionDetails(req: any, res: any) {
    return {
      prompt: 'login',
      params: { client_id: 'test-client' },
      meta: {}
    };
  }

  async interactionFinished(req: any, res: any, result: any, options?: any) {
    return res.redirect('/callback');
  }

  on(event: string, handler: Function) {
    // Mock event handler
  }

  adapter(name: string) {
    return {
      upsert: jest.fn(),
      find: jest.fn(),
      destroy: jest.fn(),
      revokeByGrantId: jest.fn(),
      consume: jest.fn()
    };
  }
}

export interface Configuration {
  responseTypes?: string[];
  grantTypes?: string[];
  pkce?: any;
  clients?: any[];
  audience?: string;
  features?: any;
  formats?: any;
  scopes?: string[];
  cookies?: any;
  adapter?: Function;
  extraParams?: string[];
}
