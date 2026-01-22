import type { User, Session } from '$lib/types';

declare global {
  namespace App {
    interface Error {
      message: string;
    }
    interface Locals {
      user?: User;
      session?: Session;
    }
    interface PageData {
      user?: User;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
