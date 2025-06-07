from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from mesa import Agent, Model
from mesa.time import RandomActivation
import threading
import time
import random
class OrderAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.orders = []
        self.order_history = []

    def place_order(self, item, quantity=1):
        order = {'item': item, 'quantity': quantity}
        self.orders.append(order)
        self.order_history.append(order)
        return self.model.warehouse_agent.process_order_immediately(item, quantity)

    def step(self):
        pass

class WarehouseAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.inventory = {"widget": 5, "gadget": 3, "thing": 2}
        self.pending_orders = []
        self.inventory_history = []
        self.log_inventory()

    def log_inventory(self):
        self.inventory_history.append(self.inventory.copy())

    def receive_order(self, item, quantity=1):
        order = {'item': item, 'quantity': quantity}
        self.pending_orders.append(order)

    def process_order_immediately(self, item, quantity=1):
        """Process order immediately for web interface to ensure real-time inventory updates"""
        if item in self.inventory and self.inventory[item] >= quantity:
            self.inventory[item] -= quantity
            self.log_inventory()

            order = {'item': item, 'quantity': quantity}
            self.model.delivery_agent.receive_delivery(order)
            return True
        else:
            available = self.inventory.get(item, 0)
            self.model.customer_agent.notify(f"Order for {quantity} x '{item}' cannot be fulfilled. Only {available} available.")
            return False

    def add_inventory(self, item, quantity):
        if item in self.inventory:
            self.inventory[item] += quantity
        else:
            self.inventory[item] = quantity
        self.log_inventory()
        return True

    def update_inventory(self, item, quantity):
        if item in self.inventory:
            self.inventory[item] = max(0, quantity)
            self.log_inventory()
            return True
        return False

    def remove_item(self, item):
        if item in self.inventory:
            del self.inventory[item]
            self.log_inventory()
            return True
        return False

    def step(self):
        if self.pending_orders:
            order = self.pending_orders.pop(0)
            item = order['item'] if isinstance(order, dict) else order
            quantity = order['quantity'] if isinstance(order, dict) else 1
            self.process_order_immediately(item, quantity)

class DeliveryAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.deliveries = []
        self.delivery_history = []

    def receive_delivery(self, order):
        delivery_duration = random.randint(40, 65)
        estimated_delivery = time.time() + delivery_duration

        if isinstance(order, dict):
            item = order['item']
            quantity = order['quantity']
            order_display = f"{quantity} x {item}"
        else:
            item = order
            quantity = 1
            order_display = item

        delivery = {
            "item": item,
            "quantity": quantity,
            "order_display": order_display,
            "status": "Shipped",
            "start_time": time.time(),
            "estimated_delivery": estimated_delivery,
            "delivery_duration": delivery_duration
        }
        self.deliveries.append(delivery)

    def step(self):
        current_time = time.time()
        for delivery in self.deliveries[:]:
            if delivery["status"] == "Shipped" and current_time >= delivery["estimated_delivery"]:
                delivery["status"] = "Delivered"
                delivery["delivery_time"] = current_time
                self.delivery_history.append(delivery.copy())

                display_text = delivery.get('order_display', delivery['item'])
                self.model.customer_agent.notify(f"Your package '{display_text}' has been delivered!")
                self.model.monitor_agent.log_delivery(delivery['item'])
                self.deliveries.remove(delivery)

class CustomerAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.notifications = []

    def notify(self, message):
        self.notifications.append({"message": message, "time": time.time()})

    def step(self):
        pass

class MonitorAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.delivered_today = 0
        self.delivery_log = []

    def log_delivery(self, item):
        self.delivered_today += 1
        self.delivery_log.append({"item": item, "time": time.time()})

    def get_summary(self):
        return {
            "delivered_today": self.delivered_today,
            "delivery_log": self.delivery_log
        }

    def step(self):
        pass

class DeliveryModel(Model):
    def __init__(self):
        super().__init__()
        self.schedule = RandomActivation(self)
        self.order_agent = OrderAgent(0, self)
        self.warehouse_agent = WarehouseAgent(1, self)
        self.delivery_agent = DeliveryAgent(2, self)
        self.customer_agent = CustomerAgent(3, self)
        self.monitor_agent = MonitorAgent(4, self)

        self.schedule.add(self.order_agent)
        self.schedule.add(self.warehouse_agent)
        self.schedule.add(self.delivery_agent)
        self.schedule.add(self.customer_agent)
        self.schedule.add(self.monitor_agent)

        self.running = True

    def step(self):
        self.schedule.step()

# IDCN Multi-Agent System
model = DeliveryModel()

app = Flask(__name__)
app.secret_key = 'idcn_secret_key'

# Background Simulation
def run_simulation():
    while model.running:
        model.step()
        time.sleep(2)

sim_thread = threading.Thread(target=run_simulation, daemon=True)
sim_thread.start()

@app.route('/')
def index():
    inventory = model.warehouse_agent.inventory
    notifications = model.customer_agent.notifications
    deliveries = model.delivery_agent.deliveries
    delivery_history = model.delivery_agent.delivery_history
    summary = model.monitor_agent.get_summary()

    return render_template('index.html',
                          inventory=inventory,
                          notifications=notifications,
                          deliveries=deliveries,
                          delivery_history=delivery_history,
                          summary=summary)

@app.route('/place_order', methods=['POST'])
def place_order():
    item = request.form.get('item')
    quantity = request.form.get('quantity')
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    try:
        quantity = int(quantity) if quantity else 1

        if item and quantity > 0:
            if item not in model.warehouse_agent.inventory:
                message = f"Item '{item}' not found in inventory"
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, "error")
                return redirect(url_for('index'))

            available_stock = model.warehouse_agent.inventory[item]
            if quantity > available_stock:
                message = f"Insufficient stock for '{item}'. Available: {available_stock}, Requested: {quantity}"
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, "error")
                return redirect(url_for('index'))

            success = model.order_agent.place_order(item, quantity)
            if success:
                message = f"Order for {quantity} x '{item}' placed successfully"
                if is_ajax:
                    return jsonify({'success': True, 'message': message})
                flash(message, "success")
            else:
                message = f"Order for {quantity} x '{item}' could not be fulfilled"
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, "error")
        else:
            message = "Please select a valid item and quantity"
            if is_ajax:
                return jsonify({'success': False, 'message': message})
            flash(message, "error")
    except ValueError:
        message = "Please enter a valid quantity"
        if is_ajax:
            return jsonify({'success': False, 'message': message})
        flash(message, "error")

    return redirect(url_for('index'))

@app.route('/add_inventory', methods=['POST'])
def add_inventory():
    item = request.form.get('item')
    quantity = request.form.get('quantity')
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    try:
        quantity = int(quantity)
        if item and quantity > 0:
            success = model.warehouse_agent.add_inventory(item, quantity)
            if success:
                message = f"Added {quantity} units of '{item}' to inventory"
                if is_ajax:
                    return jsonify({'success': True, 'message': message})
                flash(message, "success")
            else:
                message = "Failed to update inventory"
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, "error")
        else:
            message = "Please enter a valid item and quantity"
            if is_ajax:
                return jsonify({'success': False, 'message': message})
            flash(message, "error")
    except ValueError:
        message = "Quantity must be a valid number"
        if is_ajax:
            return jsonify({'success': False, 'message': message})
        flash(message, "error")

    return redirect(url_for('index'))

@app.route('/update_inventory', methods=['POST'])
def update_inventory():
    item = request.form.get('item')
    quantity = request.form.get('quantity')
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    try:
        quantity = int(quantity)
        if item and quantity >= 0:
            success = model.warehouse_agent.update_inventory(item, quantity)
            if success:
                message = f"Updated '{item}' quantity to {quantity}"
                if is_ajax:
                    return jsonify({'success': True, 'message': message})
                flash(message, "success")
            else:
                message = "Failed to update inventory"
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, "error")
        else:
            message = "Please enter a valid quantity (0 or greater)"
            if is_ajax:
                return jsonify({'success': False, 'message': message})
            flash(message, "error")
    except ValueError:
        message = "Quantity must be a valid number"
        if is_ajax:
            return jsonify({'success': False, 'message': message})
        flash(message, "error")

    return redirect(url_for('index'))

@app.route('/remove_inventory', methods=['POST'])
def remove_inventory():
    item = request.form.get('item')
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    if item:
        success = model.warehouse_agent.remove_item(item)
        if success:
            message = f"Removed '{item}' from inventory"
            if is_ajax:
                return jsonify({'success': True, 'message': message})
            flash(message, "success")
        else:
            message = "Failed to remove item from inventory"
            if is_ajax:
                return jsonify({'success': False, 'message': message})
            flash(message, "error")
    else:
        message = "Invalid item"
        if is_ajax:
            return jsonify({'success': False, 'message': message})
        flash(message, "error")

    return redirect(url_for('index'))

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'inventory': model.warehouse_agent.inventory,
        'pending_orders': model.warehouse_agent.pending_orders,
        'deliveries': len(model.delivery_agent.deliveries),
        'notifications': len(model.customer_agent.notifications),
        'delivered_today': model.monitor_agent.delivered_today
    })

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    return jsonify({
        'metrics': {
            'delivered_today': model.monitor_agent.delivered_today,
            'pending_deliveries': len(model.delivery_agent.deliveries),
            'completed_deliveries': len(model.delivery_agent.delivery_history),
            'notifications': len(model.customer_agent.notifications)
        },
        'inventory': model.warehouse_agent.inventory,
        'deliveries': model.delivery_agent.deliveries,
        'notifications': model.customer_agent.notifications,
        'delivery_history': model.delivery_agent.delivery_history
    })

if __name__ == '__main__':
    app.run(debug=True)
