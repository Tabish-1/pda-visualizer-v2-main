

// This implements the stack data structure for PDA

export class Stack {
  private items: string[];

  constructor() {
    this.items = [];
  }

  // Add an item to the top of the stack
  push(symbol: string): void {
    this.items.push(symbol);
  }

  // Remove and return the top item
  pop(): string | null {
    return this.items.length > 0 ? this.items.pop()! : null;
  }

  // Look at the top item without removing it
  peek(): string | null {
    return this.items.length > 0 ? this.items[this.items.length - 1] : null;
  }

  // Check if stack is empty
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Get all items (top to bottom)
  getContents(): string[] {
    return [...this.items].reverse();
  }

  // Clear all items
  clear(): void {
    this.items = [];
  }

  // Create a copy of this stack
  clone(): Stack {
    const newStack = new Stack();
    newStack.items = [...this.items];
    return newStack;
  }
}