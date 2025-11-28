/**
 * Représente une application installée sur le système telle que retournée par le processus principal
 */
export interface SystemApplication {
  id: string;
  name: string;
  path: string;
  icon?: string;
}
