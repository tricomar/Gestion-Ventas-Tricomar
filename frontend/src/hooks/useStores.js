import { useMemo } from 'react';
import { useAccount } from '../context/AccountContext';
import { useSettings } from '../context/SettingsContext';

/**
 * Hook personalizado para obtener las tiendas activas del usuario
 * Combina información del account (stores array) con settings (nombres legacy)
 */
export const useStores = () => {
  const { account } = useAccount();
  const { settings } = useSettings();

  const stores = useMemo(() => {
    if (!account || !account.stores || account.stores.length === 0) {
      // Fallback a configuración legacy de 2 tiendas
      return [
        {
          id: 'store_a',
          key: 'A',
          name: settings?.store_a_name || 'Tienda A',
          active: true,
          color: '#D4F0A5'
        },
        {
          id: 'store_b',
          key: 'B',
          name: settings?.store_b_name || 'Tienda B',
          active: true,
          color: '#FADBB0'
        }
      ];
    }

    // Retornar tiendas activas del account
    const colors = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7'];
    return account.stores
      .filter(store => store.active)
      .slice(0, account.max_stores || 2)
      .map((store, index) => ({
        ...store,
        key: String.fromCharCode(65 + index), // A, B, C, D, etc.
        color: colors[index % colors.length]
      }));
  }, [account, settings]);

  const storeOptions = useMemo(() => {
    return stores.map(store => ({
      value: store.key,
      label: store.name
    }));
  }, [stores]);

  const getStoreById = (storeId) => {
    return stores.find(s => s.id === storeId);
  };

  const getStoreByKey = (key) => {
    return stores.find(s => s.key === key);
  };

  const getStoreName = (key) => {
    const store = getStoreByKey(key);
    return store ? store.name : `Tienda ${key}`;
  };

  return {
    stores,
    storeOptions,
    getStoreById,
    getStoreByKey,
    getStoreName,
    storeCount: stores.length
  };
};
