import fs from 'fs';
import path from 'path';
import util from 'node:util';
const exec = util.promisify(require('node:child_process').exec);

const LOG_FILE_PATH = '../log/restartCount.txt';
class ServiceMonitor {
  private restartCount: number;
  private readonly threshold: number;

  constructor(threshold: number = 100) {
    this.restartCount = 0;
    this.threshold = threshold;
    this.loadRestartCount();
  }

  private async execSS(): Promise<number> {
    try {
      const { stdout, stderr } = await exec('ss -s');
      if (stderr) {
        console.error(`exec ss -s error: ${stderr}`);
        return -1;
      }
      const lines = stdout.split('\n');
      let totalConnections = 0;

      lines.forEach((line: any) => {
        if (line.includes('TCP:')) {
          const match = line.match(/estab\s+(\d+)/);
          if (match) {
            totalConnections = parseInt(match[1], 10);
          }
        }
      });
      return totalConnections;
    } catch (error: any) {
      console.error('exec failed[ss]:', error.message);
      return -1;
    }
  }

  private async execNetstat(): Promise<number> {
    try {
      const { stdout, stderr } = await exec('netstat -an | grep tcp | wc -l');
      if (stderr) {
        console.error(`exec netstat failed: ${stderr}`);
        return -1;
      }
      const totalConnections = parseInt(stdout.trim(), 10);
      console.log(`Current TCP connections[netstat]:: ${totalConnections}`);
      return totalConnections;
    } catch (error: any) {
      console.error('exec failed[netstat]:', error.message);
      return -1;
    }
  }

  private async monitorConnections(): Promise<void> {
    const result = await Promise.all([this.execNetstat(), this.execSS()]);
    console.log('result: ', result);
    const totalConnections = Math.max(...result);
    console.log('totalConnections: ', totalConnections);

    if (totalConnections > this.threshold) {
      console.log('Too many connections, restarting service...');
      await this.restartService();
      this.updateRestartCount();
    } else {
      console.log('Connections under threshold, no need to restart');
    }
  }

  private async restartService(): Promise<void> {
    console.log('Restarting service...');
    const { stdout } = await exec(`sh ${path.join(__dirname)}/../restart.sh`);
    console.log('restartService stdout: ', stdout);
  }

  private updateRestartCount(): void {
    this.restartCount += 1;
    fs.writeFileSync(path.join(__dirname, LOG_FILE_PATH), this.restartCount.toString(), 'utf8');
  }

  private loadRestartCount(): void {
    if (fs.existsSync(path.join(__dirname, LOG_FILE_PATH))) {
      this.restartCount = parseInt(fs.readFileSync(path.join(__dirname, LOG_FILE_PATH), 'utf8'), 10);
    } else {
      this.restartCount = 0;
    }
  }

  public startMonitoring(interval: number = 60000): void {
    this.monitorConnections();
    setInterval(() => this.monitorConnections(), interval);
  }
}

const monitor = new ServiceMonitor(200);
monitor.startMonitoring(60 * 1000);

