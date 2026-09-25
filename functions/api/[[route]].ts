import app from '../../src/worker/index';

export const onRequest = async (context: any): Promise<Response> => {
  return (app as any).fetch(context.request, context.env, context);
};
