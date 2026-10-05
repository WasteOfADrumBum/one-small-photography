declare namespace App {
  interface Locals {
    user: import('./db/schema').User | null;
  }
}
