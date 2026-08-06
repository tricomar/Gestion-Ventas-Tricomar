<?php
/**
 * Negocio Feliz Webhooks Module for PrestaShop
 * 
 * Envía webhooks en tiempo real a Negocio Feliz ERP
 * cuando ocurren eventos importantes en la tienda
 *
 * @author Negocio Feliz
 * @version 1.0.0
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Emergent_Webhooks extends Module
{
    public function __construct()
    {
        $this->name = 'emergent_webhooks';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Negocio Feliz';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = array('min' => '1.6', 'max' => _PS_VERSION_);
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Negocio Feliz Webhooks');
        $this->description = $this->l('Sincronización en tiempo real con Negocio Feliz ERP mediante webhooks');
        $this->confirmUninstall = $this->l('¿Estás seguro de desinstalar este módulo?');
    }

    public function install()
    {
        if (!parent::install()
            || !$this->registerHook('actionProductAdd')
            || !$this->registerHook('actionProductUpdate')
            || !$this->registerHook('actionProductDelete')
            || !$this->registerHook('actionValidateOrder')
            || !$this->registerHook('actionOrderStatusUpdate')
            || !$this->registerHook('actionObjectCustomerAddAfter')
            || !$this->registerHook('actionObjectCustomerUpdateAfter')
            || !$this->registerHook('actionUpdateQuantity')
            || !Configuration::updateValue('EMERGENT_WEBHOOK_URL', '')
            || !Configuration::updateValue('EMERGENT_WEBHOOK_ENABLED', '1')
        ) {
            return false;
        }

        return true;
    }

    public function uninstall()
    {
        if (!parent::uninstall()
            || !Configuration::deleteByName('EMERGENT_WEBHOOK_URL')
            || !Configuration::deleteByName('EMERGENT_WEBHOOK_ENABLED')
        ) {
            return false;
        }

        return true;
    }

    /**
     * Configuración del módulo
     */
    public function getContent()
    {
        $output = null;

        if (Tools::isSubmit('submit' . $this->name)) {
            $webhook_url = (string)Tools::getValue('EMERGENT_WEBHOOK_URL');
            $webhook_enabled = (bool)Tools::getValue('EMERGENT_WEBHOOK_ENABLED');

            if (!$webhook_url || empty($webhook_url)) {
                $output .= $this->displayError($this->l('URL de Webhook es requerida'));
            } else {
                Configuration::updateValue('EMERGENT_WEBHOOK_URL', $webhook_url);
                Configuration::updateValue('EMERGENT_WEBHOOK_ENABLED', $webhook_enabled);
                $output .= $this->displayConfirmation($this->l('Configuración guardada exitosamente'));
            }
        }

        return $output . $this->displayForm();
    }

    /**
     * Formulario de configuración
     */
    public function displayForm()
    {
        $default_lang = (int)Configuration::get('PS_LANG_DEFAULT');

        $fields_form = array(
            'form' => array(
                'legend' => array(
                    'title' => $this->l('Configuración de Webhooks'),
                    'icon' => 'icon-cogs'
                ),
                'input' => array(
                    array(
                        'type' => 'text',
                        'label' => $this->l('URL de Webhook'),
                        'name' => 'EMERGENT_WEBHOOK_URL',
                        'size' => 100,
                        'required' => true,
                        'desc' => $this->l('URL completa del endpoint de webhooks. Ejemplo: https://tu-dominio.com/api/integrations/webhooks/prestashop/integration-id')
                    ),
                    array(
                        'type' => 'switch',
                        'label' => $this->l('Activar Webhooks'),
                        'name' => 'EMERGENT_WEBHOOK_ENABLED',
                        'is_bool' => true,
                        'desc' => $this->l('Activar o desactivar el envío de webhooks'),
                        'values' => array(
                            array(
                                'id' => 'active_on',
                                'value' => 1,
                                'label' => $this->l('Activado')
                            ),
                            array(
                                'id' => 'active_off',
                                'value' => 0,
                                'label' => $this->l('Desactivado')
                            )
                        ),
                    ),
                ),
                'submit' => array(
                    'title' => $this->l('Guardar'),
                    'class' => 'btn btn-default pull-right'
                )
            ),
        );

        $helper = new HelperForm();

        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;

        $helper->default_form_language = $default_lang;
        $helper->allow_employee_form_lang = $default_lang;

        $helper->title = $this->displayName;
        $helper->show_toolbar = true;
        $helper->toolbar_scroll = true;
        $helper->submit_action = 'submit' . $this->name;
        $helper->toolbar_btn = array(
            'save' => array(
                'desc' => $this->l('Guardar'),
                'href' => AdminController::$currentIndex . '&configure=' . $this->name . '&save' . $this->name .
                    '&token=' . Tools::getAdminTokenLite('AdminModules'),
            ),
            'back' => array(
                'href' => AdminController::$currentIndex . '&token=' . Tools::getAdminTokenLite('AdminModules'),
                'desc' => $this->l('Volver')
            )
        );

        $helper->fields_value['EMERGENT_WEBHOOK_URL'] = Configuration::get('EMERGENT_WEBHOOK_URL');
        $helper->fields_value['EMERGENT_WEBHOOK_ENABLED'] = Configuration::get('EMERGENT_WEBHOOK_ENABLED');

        return $helper->generateForm(array($fields_form));
    }

    /**
     * Enviar webhook
     */
    private function sendWebhook($event, $resource, $resource_id, $data = null)
    {
        $webhook_url = Configuration::get('EMERGENT_WEBHOOK_URL');
        $enabled = Configuration::get('EMERGENT_WEBHOOK_ENABLED');

        if (!$enabled || !$webhook_url) {
            return;
        }

        $payload = array(
            'event' => $event,
            'resource' => $resource,
            'resource_id' => (int)$resource_id,
            'data' => $data,
            'timestamp' => date('c')
        );

        $ch = curl_init($webhook_url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        curl_close($ch);

        // Log para debug (opcional)
        if ($http_code != 200) {
            error_log("Negocio Feliz Webhook Error: HTTP $http_code - Event: $event - Resource: $resource - ID: $resource_id");
        }
    }

    /**
     * Hook: Producto creado
     */
    public function hookActionProductAdd($params)
    {
        if (isset($params['id_product'])) {
            $this->sendWebhook('product_created', 'product', $params['id_product']);
        }
    }

    /**
     * Hook: Producto actualizado
     */
    public function hookActionProductUpdate($params)
    {
        if (isset($params['id_product'])) {
            $this->sendWebhook('product_updated', 'product', $params['id_product']);
        }
    }

    /**
     * Hook: Producto eliminado
     */
    public function hookActionProductDelete($params)
    {
        if (isset($params['id_product'])) {
            $this->sendWebhook('product_deleted', 'product', $params['id_product']);
        }
    }

    /**
     * Hook: Orden creada/validada
     */
    public function hookActionValidateOrder($params)
    {
        if (isset($params['order']) && isset($params['order']->id)) {
            $this->sendWebhook('order_created', 'order', $params['order']->id);
        }
    }

    /**
     * Hook: Estado de orden actualizado
     */
    public function hookActionOrderStatusUpdate($params)
    {
        if (isset($params['id_order'])) {
            $this->sendWebhook('order_updated', 'order', $params['id_order']);
        }
    }

    /**
     * Hook: Cliente creado
     */
    public function hookActionObjectCustomerAddAfter($params)
    {
        if (isset($params['object']) && isset($params['object']->id)) {
            $this->sendWebhook('customer_created', 'customer', $params['object']->id);
        }
    }

    /**
     * Hook: Cliente actualizado
     */
    public function hookActionObjectCustomerUpdateAfter($params)
    {
        if (isset($params['object']) && isset($params['object']->id)) {
            $this->sendWebhook('customer_updated', 'customer', $params['object']->id);
        }
    }

    /**
     * Hook: Stock actualizado
     */
    public function hookActionUpdateQuantity($params)
    {
        if (isset($params['id_product'])) {
            $this->sendWebhook('stock_updated', 'stock', $params['id_product'], array(
                'quantity' => isset($params['quantity']) ? $params['quantity'] : null
            ));
        }
    }
}
